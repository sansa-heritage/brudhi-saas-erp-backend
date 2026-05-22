const db = require("../../config/db");

class StateService {
  async getAllStates(filters = {}) {
    let query = `
      SELECT s.*, c.name as country_name 
      FROM states s 
      LEFT JOIN countries c ON s.country_id = c.id 
      WHERE 1=1
    `;
    const params = [];

    if (filters.countryId) {
      query += " AND s.country_id = ?";
      params.push(parseInt(filters.countryId));
    }

    if (filters.status !== undefined) {
      query += " AND s.status = ?";
      params.push(parseInt(filters.status));
    }

    if (filters.search) {
      query += " AND (s.name LIKE ? OR s.code LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += " ORDER BY s.name ASC";
    const states = await db.query(query, params);
    return states;
  }

  async getStateById(id) {
    const states = await db.query(
      `SELECT s.*, c.name as country_name 
       FROM states s 
       LEFT JOIN countries c ON s.country_id = c.id 
       WHERE s.id = ?`,
      [parseInt(id)],
    );
    return states[0] || null;
  }

  async createState(stateData) {
    const existing = await db.query(
      "SELECT id FROM states WHERE name = ? AND country_id = ?",
      [stateData.name, stateData.countryId],
    );

    if (existing.length > 0) {
      throw new Error("State already exists in this country");
    }

    const result = await db.query(
      `INSERT INTO states (country_id, name, code, status) VALUES (?, ?, ?, ?)`,
      [
        stateData.countryId,
        stateData.name,
        stateData.code || null,
        stateData.status !== undefined ? parseInt(stateData.status) : 1,
      ],
    );

    return result.insertId;
  }

  // async updateState(id, stateData) {
  //   const updates = [];
  //   const params = [];

  //   if (stateData.name !== undefined) {
  //     updates.push('name = ?');
  //     params.push(stateData.name);
  //   }
  //   if (stateData.code !== undefined) {
  //     updates.push('code = ?');
  //     params.push(stateData.code);
  //   }
  //   if (stateData.status !== undefined) {
  //     updates.push('status = ?');
  //     params.push(parseInt(stateData.status));
  //   }

  //   if (updates.length === 0) return true;

  //   params.push(parseInt(id));
  //   await db.query(
  //     `UPDATE states SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
  //     params
  //   );

  //   return true;
  // }
  async updateState(id, stateData) {
    const updates = [];
    const params = [];

    if (stateData.name !== undefined) {
      updates.push("name = ?");
      params.push(stateData.name);
    }
    if (stateData.code !== undefined) {
      updates.push("code = ?");
      params.push(stateData.code);
    }
    if (stateData.countryId !== undefined) {
      // ✅ ADD THIS
      updates.push("country_id = ?");
      params.push(parseInt(stateData.countryId));
    }
    if (stateData.status !== undefined) {
      updates.push("status = ?");
      params.push(parseInt(stateData.status));
    }

    if (updates.length === 0) return true;

    params.push(parseInt(id));
    await db.query(
      `UPDATE states SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params,
    );

    return true;
  }
  // async deleteState(id) {
  //   const cities = await db.query(
  //     "SELECT id FROM cities WHERE state_id = ? LIMIT 1",
  //     [parseInt(id)],
  //   );

  //   if (cities.length > 0) {
  //     throw new Error("Cannot delete state with existing cities");
  //   }

  //   await db.query("DELETE FROM states WHERE id = ?", [parseInt(id)]);
  //   return true;
  // }

  async deleteState(id) {
    const cities = await db.query(
      "SELECT id FROM cities WHERE state_id = ? LIMIT 1",
      [parseInt(id)],
    );

    if (cities.length > 0) {
      throw new Error("Cannot delete state with existing cities");
    }

    await db.query("DELETE FROM states WHERE id = ?", [parseInt(id)]);
    return true;
  }
}

module.exports = new StateService();
