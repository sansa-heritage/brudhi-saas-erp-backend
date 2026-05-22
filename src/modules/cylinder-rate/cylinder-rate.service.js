const db = require('../../config/db');
const moment = require('moment');

class CylinderRateService {
  async getAllRates(filters = {}) {
    let query = `
      SELECT cr.*, b.name as brand_name, b.code as brand_code,
             ct.name as cylinder_name, ct.weight, ct.type
      FROM cylinder_rates cr
      LEFT JOIN brands b ON cr.brand_id = b.id
      LEFT JOIN cylinder_types ct ON cr.cylinder_type_id = ct.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.brandId) {
      query += ' AND cr.brand_id = ?';
      params.push(parseInt(filters.brandId));
    }

    if (filters.cylinderTypeId) {
      query += ' AND cr.cylinder_type_id = ?';
      params.push(parseInt(filters.cylinderTypeId));
    }

    if (filters.isCurrent !== undefined) {
      query += ' AND cr.is_current = ?';
      params.push(filters.isCurrent === 'true' ? 1 : 0);
    }

    query += ' ORDER BY cr.effective_from DESC, b.name ASC, ct.weight ASC';
    const rates = await db.query(query, params);
    return rates;
  }

  async getRateById(id) {
    const rates = await db.query(
      `SELECT cr.*, b.name as brand_name, ct.name as cylinder_name
       FROM cylinder_rates cr
       LEFT JOIN brands b ON cr.brand_id = b.id
       LEFT JOIN cylinder_types ct ON cr.cylinder_type_id = ct.id
       WHERE cr.id = ?`,
      [parseInt(id)]
    );
    return rates[0] || null;
  }

  async getCurrentRate(brandId, cylinderTypeId) {
    const rates = await db.query(
      `SELECT * FROM cylinder_rates 
       WHERE brand_id = ? AND cylinder_type_id = ? 
       AND is_current = true 
       AND effective_from <= CURDATE()
       AND (effective_to IS NULL OR effective_to >= CURDATE())
       LIMIT 1`,
      [parseInt(brandId), parseInt(cylinderTypeId)]
    );
    return rates[0] || null;
  }

  async createRate(rateData) {
    return await db.transaction(async (connection) => {
      const existing = await connection.execute(
        `SELECT id FROM cylinder_rates 
         WHERE brand_id = ? AND cylinder_type_id = ? 
         AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)`,
        [rateData.brandId, rateData.cylinderTypeId, rateData.effectiveFrom, rateData.effectiveFrom]
      );

      if (existing[0].length > 0) {
        throw new Error('Rate already exists for this period');
      }

      let isCurrent = rateData.isCurrent !== undefined ? rateData.isCurrent : true;

      if (isCurrent) {
        await connection.execute(
          `UPDATE cylinder_rates 
           SET is_current = false, updated_at = NOW()
           WHERE brand_id = ? AND cylinder_type_id = ? AND is_current = true`,
          [rateData.brandId, rateData.cylinderTypeId]
        );
      }

      const [result] = await connection.execute(
        `INSERT INTO cylinder_rates 
         (brand_id, cylinder_type_id, price, gst_percent, cess, effective_from, effective_to, is_current) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rateData.brandId,
          rateData.cylinderTypeId,
          rateData.price,
          rateData.gstPercent || 5.00,
          rateData.cess || 0,
          rateData.effectiveFrom,
          rateData.effectiveTo || null,
          isCurrent ? 1 : 0
        ]
      );

      return result.insertId;
    });
  }

  async updateRate(id, rateData) {
    return await db.transaction(async (connection) => {
      const updates = [];
      const params = [];

      if (rateData.price !== undefined) {
        updates.push('price = ?');
        params.push(rateData.price);
      }
      if (rateData.gstPercent !== undefined) {
        updates.push('gst_percent = ?');
        params.push(rateData.gstPercent);
      }
      if (rateData.cess !== undefined) {
        updates.push('cess = ?');
        params.push(rateData.cess);
      }
      if (rateData.effectiveFrom !== undefined) {
        updates.push('effective_from = ?');
        params.push(rateData.effectiveFrom);
      }
      if (rateData.effectiveTo !== undefined) {
        updates.push('effective_to = ?');
        params.push(rateData.effectiveTo);
      }
      if (rateData.isCurrent !== undefined) {
        updates.push('is_current = ?');
        params.push(rateData.isCurrent ? 1 : 0);
        
        if (rateData.isCurrent) {
          const [rate] = await connection.execute(
            'SELECT brand_id, cylinder_type_id FROM cylinder_rates WHERE id = ?',
            [parseInt(id)]
          );
          
          if (rate[0]) {
            await connection.execute(
              `UPDATE cylinder_rates 
               SET is_current = false, updated_at = NOW()
               WHERE brand_id = ? AND cylinder_type_id = ? AND id != ? AND is_current = true`,
              [rate[0].brand_id, rate[0].cylinder_type_id, parseInt(id)]
            );
          }
        }
      }

      if (updates.length === 0) return true;

      params.push(parseInt(id));
      await connection.execute(
        `UPDATE cylinder_rates SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );

      return true;
    });
  }

  async deleteRate(id) {
    await db.query('DELETE FROM cylinder_rates WHERE id = ?', [parseInt(id)]);
    return true;
  }

  async getRatesByBrand(brandId) {
    const rates = await db.query(
      `SELECT cr.*, ct.name as cylinder_name, ct.weight, ct.type
       FROM cylinder_rates cr
       LEFT JOIN cylinder_types ct ON cr.cylinder_type_id = ct.id
       WHERE cr.brand_id = ? AND cr.is_current = true
       ORDER BY ct.weight ASC`,
      [parseInt(brandId)]
    );
    return rates;
  }
}

module.exports = new CylinderRateService();