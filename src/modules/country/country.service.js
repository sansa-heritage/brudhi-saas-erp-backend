const db = require("../../config/db");
const DatabaseManager = require("../../services/database-manager.service");

class CountryService {
  async getAllCountries(filters = {}) {
    let query = "SELECT * FROM countries WHERE 1=1";
    const params = [];

    if (filters.status !== undefined) {
      query += " AND status = ?";
      params.push(parseInt(filters.status));
    }

    if (filters.search) {
      query += " AND (name LIKE ? OR code LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += " ORDER BY name ASC";

    const page = parseInt(filters.page) || 1;
    const limit = Math.min(100, parseInt(filters.limit) || 100);
    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const countries = await db.query(query, params);

    const countResult = await db.query(
      "SELECT COUNT(*) as total FROM countries",
      [],
    );
    const total = countResult[0]?.total || 0;

    return {
      data: countries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCountryById(id) {
    const countries = await db.query("SELECT * FROM countries WHERE id = ?", [
      parseInt(id),
    ]);
    return countries[0] || null;
  }

  async createCountry(countryData) {
    const existing = await db.query(
      "SELECT id FROM countries WHERE name = ? OR code = ?",
      [countryData.name, countryData.code],
    );

    if (existing.length > 0) {
      throw new Error("Country name or code already exists");
    }

    const result = await db.query(
      `INSERT INTO countries (name, code, status) VALUES (?, ?, ?)`,
      [
        countryData.name,
        countryData.code || null,
        countryData.status !== undefined ? parseInt(countryData.status) : 1,
      ],
    );

    return result.insertId;
  }

  async updateCountry(id, countryData) {
    const updates = [];
    const params = [];

    if (countryData.name !== undefined) {
      updates.push("name = ?");
      params.push(countryData.name);
    }
    if (countryData.code !== undefined) {
      updates.push("code = ?");
      params.push(countryData.code);
    }
    if (countryData.status !== undefined) {
      updates.push("status = ?");
      params.push(parseInt(countryData.status));
    }

    if (updates.length === 0) return true;

    params.push(parseInt(id));
    await db.query(
      `UPDATE countries SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params,
    );

    return true;
  }

  async deleteCountry(id) {
    const states = await db.query(
      "SELECT id FROM states WHERE country_id = ? LIMIT 1",
      [parseInt(id)],
    );

    if (states.length > 0) {
      throw new Error("Cannot delete country with existing states");
    }

    await db.query("DELETE FROM countries WHERE id = ?", [parseInt(id)]);
    return true;
  }

  //toggling status
  async toggleStatus(id) {
    // First, get the current country
    const country = await this.getCountryById(id);

    if (!country) {
      throw new Error("Country not found");
    }

    // Toggle the status (1 -> 0, 0 -> 1)
    const newStatus = country.status === 1 ? 0 : 1;

    // Update the status
    await db.query(
      "UPDATE countries SET status = ?, updated_at = NOW() WHERE id = ?",
      [newStatus, parseInt(id)],
    );

    // Return the updated country with new status
    const updatedCountry = await this.getCountryById(id);
    return updatedCountry;
  }
}

module.exports = new CountryService();
