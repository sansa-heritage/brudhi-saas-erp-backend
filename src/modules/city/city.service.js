const db = require("../../config/db");

class CityService {
  async getAllCities(filters = {}) {
    let query = `
      SELECT c.*, s.name as state_name, s.country_id, co.name as country_name
      FROM cities c 
      LEFT JOIN states s ON c.state_id = s.id
      LEFT JOIN countries co ON s.country_id = co.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.stateId) {
      query += " AND c.state_id = ?";
      params.push(parseInt(filters.stateId));
    }

    if (filters.countryId) {
      query += " AND s.country_id = ?";
      params.push(parseInt(filters.countryId));
    }

    if (filters.status !== undefined) {
      query += " AND c.status = ?";
      params.push(parseInt(filters.status));
    }

    if (filters.search) {
      query += " AND c.name LIKE ?";
      params.push(`%${filters.search}%`);
    }

    query += " ORDER BY c.name ASC";
    const cities = await db.query(query, params);
    return cities;
  }

  async getCityById(id) {
    const cities = await db.query(
      `SELECT c.*, s.name as state_name, s.country_id, co.name as country_name
       FROM cities c 
       LEFT JOIN states s ON c.state_id = s.id
       LEFT JOIN countries co ON s.country_id = co.id
       WHERE c.id = ?`,
      [parseInt(id)],
    );
    return cities[0] || null;
  }

  async createCity(cityData) {
    const existing = await db.query(
      "SELECT id FROM cities WHERE name = ? AND state_id = ?",
      [cityData.name, cityData.stateId],
    );

    if (existing.length > 0) {
      throw new Error("City already exists in this state");
    }

    const result = await db.query(
      `INSERT INTO cities (state_id, name, status) VALUES (?, ?, ?)`,
      [
        cityData.stateId,
        cityData.name,
        cityData.status !== undefined ? parseInt(cityData.status) : 1,
      ],
    );

    return result.insertId;
  }

  // async updateCity(id, cityData) {
  //   const updates = [];
  //   const params = [];

  //   if (cityData.name !== undefined) {
  //     updates.push('name = ?');
  //     params.push(cityData.name);
  //   }
  //   if (cityData.status !== undefined) {
  //     updates.push('status = ?');
  //     params.push(parseInt(cityData.status));
  //   }

  //   if (updates.length === 0) return true;

  //   params.push(parseInt(id));
  //   await db.query(
  //     `UPDATE cities SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
  //     params
  //   );

  //   return true;
  // }

  async updateCity(id, cityData) {
    const updates = [];
    const params = [];

    if (cityData.name !== undefined) {
      updates.push("name = ?");
      params.push(cityData.name);
    }
    if (cityData.stateId !== undefined) {
      // ✅ ADD THIS
      updates.push("state_id = ?");
      params.push(parseInt(cityData.stateId));
    }
    if (cityData.status !== undefined) {
      updates.push("status = ?");
      params.push(parseInt(cityData.status));
    }

    if (updates.length === 0) return true;

    params.push(parseInt(id));
    await db.query(
      `UPDATE cities SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params,
    );

    return true;
  }

  async deleteCity(id) {
    const pincodes = await db.query(
      "SELECT id FROM pincodes WHERE city_id = ? LIMIT 1",
      [parseInt(id)],
    );

    if (pincodes.length > 0) {
      throw new Error("Cannot delete city with existing pincodes");
    }

    await db.query("DELETE FROM cities WHERE id = ?", [parseInt(id)]);
    return true;
  }
}

module.exports = new CityService();
