const express = require('express');
const router = express.Router();
const CityService = require('./city.service');
const ResponseUtil = require('../../utils/response');
const AuthMiddleware = require('../../middlewares/auth.middleware');

router.get('/dropdown', async (req, res) => {
  try {
    const cities = await CityService.getAllCities({ stateId: req.query.stateId });
    return ResponseUtil.success(res, cities, 'Cities fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.use(AuthMiddleware.authenticate);
router.get('/', async (req, res) => {
  try {
    const cities = await CityService.getAllCities(req.query);
    return ResponseUtil.success(res, cities, 'Cities fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const city = await CityService.getCityById(req.params.id);
    if (!city) return ResponseUtil.notFound(res, 'City not found');
    return ResponseUtil.success(res, city, 'City fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.post('/', async (req, res) => {
  try {
    const cityId = await CityService.createCity(req.body);
    const city = await CityService.getCityById(cityId);
    return ResponseUtil.created(res, city, 'City created successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.put('/:id', async (req, res) => {
  try {
    await CityService.updateCity(req.params.id, req.body);
    const city = await CityService.getCityById(req.params.id);
    return ResponseUtil.success(res, city, 'City updated successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await CityService.deleteCity(req.params.id);
    return ResponseUtil.success(res, null, 'City deleted successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

module.exports = router;