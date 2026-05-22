const db = require('../../config/db');

class CylinderTypeService {
  async getAllCylinderTypes(filters = {}) {
    let query = 'SELECT * FROM cylinder_types WHERE 1=1';
    const params = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters.status !== undefined) {
      query += ' AND status = ?';
      params.push(parseInt(filters.status));
    }

    if (filters.search) {
      query += ' AND name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    query += ' ORDER BY weight ASC';
    const cylinderTypes = await db.query(query, params);
    return cylinderTypes;
  }

  async getCylinderTypeById(id) {
    const cylinderTypes = await db.query(
      'SELECT * FROM cylinder_types WHERE id = ?',
      [parseInt(id)]
    );
    return cylinderTypes[0] || null;
  }

  async createCylinderType(data) {
    const existing = await db.query(
      'SELECT id FROM cylinder_types WHERE name = ?',
      [data.name]
    );

    if (existing.length > 0) {
      throw new Error('Cylinder type name already exists');
    }

    const result = await db.query(
      `INSERT INTO cylinder_types (name, weight, type, capacity_kg, description, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.name, data.weight, data.type, data.capacityKg || null, data.description || null, data.status !== undefined ? parseInt(data.status) : 1]
    );

    return result.insertId;
  }

  async updateCylinderType(id, data) {
    const updates = [];
    const params = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.weight !== undefined) {
      updates.push('weight = ?');
      params.push(data.weight);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      params.push(data.type);
    }
    if (data.capacityKg !== undefined) {
      updates.push('capacity_kg = ?');
      params.push(data.capacityKg);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(parseInt(data.status));
    }

    if (updates.length === 0) return true;

    params.push(parseInt(id));
    await db.query(
      `UPDATE cylinder_types SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return true;
  }

  async deleteCylinderType(id) {
    const rates = await db.query(
      'SELECT id FROM cylinder_rates WHERE cylinder_type_id = ? LIMIT 1',
      [parseInt(id)]
    );

    if (rates.length > 0) {
      throw new Error('Cannot delete cylinder type with existing rates');
    }

    await db.query('DELETE FROM cylinder_types WHERE id = ?', [parseInt(id)]);
    return true;
  }
}

module.exports = new CylinderTypeService();