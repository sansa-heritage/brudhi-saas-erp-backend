// const db = require("../../config/db");

// class PincodeService {
//   async getAllPincodes(filters = {}) {
//     let query = `
//     SELECT
//       p.id,
//       p.pincode AS code,
//       p.status,
//       p.created_at,
//       p.updated_at,
//       c.name AS city,
//       s.name AS state,
//       co.name AS country
//     FROM pincodes p
//     LEFT JOIN cities c ON p.city_id = c.id
//     LEFT JOIN states s ON c.state_id = s.id
//     LEFT JOIN countries co ON s.country_id = co.id
//     WHERE 1=1
//   `;

//     const params = [];

//     if (filters.cityId) {
//       query += " AND p.city_id = ?";
//       params.push(parseInt(filters.cityId));
//     }

//     if (filters.stateId) {
//       query += " AND s.id = ?";
//       params.push(parseInt(filters.stateId));
//     }

//     if (filters.countryId) {
//       query += " AND co.id = ?";
//       params.push(parseInt(filters.countryId));
//     }

//     if (filters.pincode) {
//       query += " AND p.pincode LIKE ?";
//       params.push(`%${filters.pincode}%`);
//     }

//     if (filters.status !== undefined) {
//       query += " AND p.status = ?";
//       params.push(parseInt(filters.status));
//     }

//     query += " ORDER BY p.pincode ASC";

//     // 🔥 HANDLE MYSQL RESPONSE PROPERLY
//     const result = await db.query(query, params);
//     const pincodes = Array.isArray(result[0]) ? result[0] : result;

//     return pincodes;
//   }

//   async getPincodeById(id) {
//     const pincodes = await db.query(
//       `SELECT p.*, c.name as city_name
//        FROM pincodes p
//        LEFT JOIN cities c ON p.city_id = c.id
//        WHERE p.id = ?`,
//       [parseInt(id)],
//     );
//     return pincodes[0] || null;
//   }

//   async getPincodeByCode(pincode) {
//     const pincodes = await db.query(
//       `SELECT p.*, c.name as city_name, c.state_id, s.name as state_name
//        FROM pincodes p
//        LEFT JOIN cities c ON p.city_id = c.id
//        LEFT JOIN states s ON c.state_id = s.id
//        WHERE p.pincode = ?`,
//       [pincode],
//     );
//     return pincodes[0] || null;
//   }

//   // async createPincode(pincodeData) {
//   //   const existing = await db.query(
//   //     'SELECT id FROM pincodes WHERE pincode = ?',
//   //     [pincodeData.pincode]
//   //   );

//   //   if (existing.length > 0) {
//   //     throw new Error('Pincode already exists');
//   //   }

//   //   const result = await db.query(
//   //     `INSERT INTO pincodes (city_id, pincode, status) VALUES (?, ?, ?)`,
//   //     [pincodeData.cityId, pincodeData.pincode, pincodeData.status !== undefined ? parseInt(pincodeData.status) : 1]
//   //   );

//   //   return result.insertId;
//   // }

//   async createPincode(pincodeData) {
//     let { city_id, city, pincode, code, status } = pincodeData;

//     if (!pincode && code) {
//       pincode = code;
//     }

//     if (!city_id && city) {
//       const result = await db.query(
//         "SELECT id FROM cities WHERE LOWER(name) = LOWER(?)",
//         [city],
//       );

//       const cityRows = Array.isArray(result[0]) ? result[0] : result;

//       if (!cityRows || cityRows.length === 0) {
//         throw new Error(`City not found: ${city}`);
//       }

//       city_id = cityRows[0].id;
//     }

//     if (!city_id || !pincode) {
//       throw new Error("city_id and pincode are required");
//     }

//     const existingResult = await db.query(
//       "SELECT id FROM pincodes WHERE pincode = ? AND city_id = ?",
//       [pincode, city_id],
//     );

//     const existing = Array.isArray(existingResult[0])
//       ? existingResult[0]
//       : existingResult;

//     if (existing.length > 0) {
//       throw new Error("Pincode already exists for this city");
//     }

//     const insertResult = await db.query(
//       `INSERT INTO pincodes (city_id, pincode, status) VALUES (?, ?, ?)`,
//       [city_id, pincode, status !== undefined ? parseInt(status) : 1],
//     );

//     const resultData = Array.isArray(insertResult[0])
//       ? insertResult[0]
//       : insertResult;

//     return resultData.insertId;
//   }

//   async updatePincode(id, pincodeData) {
//     const updates = [];
//     const params = [];

//     if (pincodeData.cityId !== undefined) {
//       updates.push("city_id = ?");
//       params.push(parseInt(pincodeData.cityId));
//     }
//     if (pincodeData.pincode !== undefined) {
//       updates.push("pincode = ?");
//       params.push(pincodeData.pincode);
//     }
//     if (pincodeData.status !== undefined) {
//       updates.push("status = ?");
//       params.push(parseInt(pincodeData.status));
//     }

//     if (updates.length === 0) return true;

//     params.push(parseInt(id));
//     await db.query(
//       `UPDATE pincodes SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
//       params,
//     );

//     return true;
//   }

//   async deletePincode(id) {
//     await db.query("DELETE FROM pincodes WHERE id = ?", [parseInt(id)]);
//     return true;
//   }
// }

// module.exports = new PincodeService();

const db = require("../../config/db");

class PincodeService {
  async getAllPincodes(filters = {}) {
    let query = `
      SELECT
        p.id,
        p.pincode AS code,
        p.status,
        p.created_at,
        p.updated_at,
        p.city_id,
        c.name AS city,
        c.state_id,
        s.name AS state,
        co.name AS country
      FROM pincodes p
      LEFT JOIN cities c ON p.city_id = c.id
      LEFT JOIN states s ON c.state_id = s.id
      LEFT JOIN countries co ON s.country_id = co.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.cityId) {
      query += " AND p.city_id = ?";
      params.push(parseInt(filters.cityId));
    }

    if (filters.stateId) {
      query += " AND s.id = ?";
      params.push(parseInt(filters.stateId));
    }

    if (filters.countryId) {
      query += " AND co.id = ?";
      params.push(parseInt(filters.countryId));
    }

    if (filters.pincode) {
      query += " AND p.pincode LIKE ?";
      params.push(`%${filters.pincode}%`);
    }

    if (filters.status !== undefined) {
      query += " AND p.status = ?";
      params.push(parseInt(filters.status));
    }

    query += " ORDER BY p.pincode ASC";

    const result = await db.query(query, params);
    const pincodes = Array.isArray(result[0]) ? result[0] : result;

    return pincodes;
  }

  async getPincodeById(id) {
    const result = await db.query(
      `SELECT 
        p.id, 
        p.pincode AS code, 
        p.status, 
        p.created_at, 
        p.updated_at,
        p.city_id,
        c.name AS city,
        c.state_id,
        s.name AS state
      FROM pincodes p 
      LEFT JOIN cities c ON p.city_id = c.id 
      LEFT JOIN states s ON c.state_id = s.id
      WHERE p.id = ?`,
      [parseInt(id)],
    );

    const pincode = Array.isArray(result[0]) ? result[0][0] : result[0];
    return pincode || null;
  }

  async getPincodeByCode(pincode) {
    const result = await db.query(
      `SELECT 
        p.*, 
        c.name as city_name, 
        c.state_id, 
        s.name as state_name
      FROM pincodes p 
      LEFT JOIN cities c ON p.city_id = c.id
      LEFT JOIN states s ON c.state_id = s.id
      WHERE p.pincode = ?`,
      [pincode],
    );

    const pincodeData = Array.isArray(result[0]) ? result[0][0] : result[0];
    return pincodeData || null;
  }

  async createPincode(pincodeData) {
    let { city_id, city, pincode, code, status } = pincodeData;

    if (!pincode && code) {
      pincode = code;
    }

    if (!city_id && city) {
      const result = await db.query(
        "SELECT id FROM cities WHERE LOWER(name) = LOWER(?)",
        [city],
      );

      const cityRows = Array.isArray(result[0]) ? result[0] : result;

      if (!cityRows || cityRows.length === 0) {
        throw new Error(`City not found: ${city}`);
      }

      city_id = cityRows[0].id;
    }

    if (!city_id || !pincode) {
      throw new Error("city_id and pincode are required");
    }

    // Check if pincode already exists for this city
    const existingResult = await db.query(
      "SELECT id FROM pincodes WHERE pincode = ? AND city_id = ?",
      [pincode, city_id],
    );

    const existing = Array.isArray(existingResult[0])
      ? existingResult[0]
      : existingResult;

    if (existing.length > 0) {
      throw new Error("Pincode already exists for this city");
    }

    const insertResult = await db.query(
      `INSERT INTO pincodes (city_id, pincode, status) VALUES (?, ?, ?)`,
      [city_id, pincode, status !== undefined ? parseInt(status) : 1],
    );

    const resultData = Array.isArray(insertResult[0])
      ? insertResult[0]
      : insertResult;

    return resultData.insertId;
  }

  async updatePincode(id, pincodeData) {
    const updates = [];
    const params = [];

    if (pincodeData.cityId !== undefined) {
      updates.push("city_id = ?");
      params.push(parseInt(pincodeData.cityId));
    }
    if (pincodeData.pincode !== undefined) {
      updates.push("pincode = ?");
      params.push(pincodeData.pincode);
    }
    if (pincodeData.status !== undefined) {
      updates.push("status = ?");
      params.push(parseInt(pincodeData.status));
    }

    if (updates.length === 0) return true;

    params.push(parseInt(id));
    await db.query(
      `UPDATE pincodes SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params,
    );

    return true;
  }

  async deletePincode(id) {
    await db.query("DELETE FROM pincodes WHERE id = ?", [parseInt(id)]);
    return true;
  }
}

module.exports = new PincodeService();
