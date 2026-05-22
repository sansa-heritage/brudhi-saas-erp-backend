const db = require('../../config/db');

class BrandService {
  async getAllBrands(filters = {}) {
    let query = 'SELECT * FROM brands WHERE 1=1';
    const params = [];

    if (filters.status !== undefined) {
      query += ' AND status = ?';
      params.push(parseInt(filters.status));
    }

    if (filters.search) {
      query += ' AND (name LIKE ? OR code LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY name ASC';
    const brands = await db.query(query, params);
    return brands;
  }

  async getBrandById(id) {
    const brands = await db.query('SELECT * FROM brands WHERE id = ?', [parseInt(id)]);
    return brands[0] || null;
  }

  async createBrand(brandData) {
    const existing = await db.query(
      'SELECT id FROM brands WHERE name = ? OR code = ?',
      [brandData.name, brandData.code]
    );

    if (existing.length > 0) {
      throw new Error('Brand name or code already exists');
    }

    const result = await db.query(
      `INSERT INTO brands (name, code, logo, description, status) VALUES (?, ?, ?, ?, ?)`,
      [brandData.name, brandData.code, brandData.logo || null, brandData.description || null, brandData.status !== undefined ? parseInt(brandData.status) : 1]
    );

    return result.insertId;
  }

  async updateBrand(id, brandData) {
    const updates = [];
    const params = [];

    if (brandData.name !== undefined) {
      updates.push('name = ?');
      params.push(brandData.name);
    }
    if (brandData.code !== undefined) {
      updates.push('code = ?');
      params.push(brandData.code);
    }
    if (brandData.logo !== undefined) {
      updates.push('logo = ?');
      params.push(brandData.logo);
    }
    if (brandData.description !== undefined) {
      updates.push('description = ?');
      params.push(brandData.description);
    }
    if (brandData.status !== undefined) {
      updates.push('status = ?');
      params.push(parseInt(brandData.status));
    }

    if (updates.length === 0) return true;

    params.push(parseInt(id));
    await db.query(
      `UPDATE brands SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return true;
  }

  async deleteBrand(id) {
    const rates = await db.query(
      'SELECT id FROM cylinder_rates WHERE brand_id = ? LIMIT 1',
      [parseInt(id)]
    );

    if (rates.length > 0) {
      throw new Error('Cannot delete brand with existing cylinder rates');
    }

    await db.query('DELETE FROM brands WHERE id = ?', [parseInt(id)]);
    return true;
  }
}

module.exports = new BrandService();