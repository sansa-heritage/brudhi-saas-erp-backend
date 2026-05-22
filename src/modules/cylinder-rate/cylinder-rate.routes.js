const express = require('express');
const router = express.Router();
const CylinderRateService = require('./cylinder-rate.service');
const ResponseUtil = require('../../utils/response');
const AuthMiddleware = require('../../middlewares/auth.middleware');

router.get('/current', async (req, res) => {
  try {
    const { brandId, cylinderTypeId } = req.query;
    if (brandId && cylinderTypeId) {
      const rate = await CylinderRateService.getCurrentRate(brandId, cylinderTypeId);
      return ResponseUtil.success(res, rate, 'Current rate fetched successfully');
    }
    
    const rates = await CylinderRateService.getAllRates({ isCurrent: true });
    return ResponseUtil.success(res, rates, 'Current rates fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.get('/brand/:brandId', async (req, res) => {
  try {
    const rates = await CylinderRateService.getRatesByBrand(req.params.brandId);
    return ResponseUtil.success(res, rates, 'Brand rates fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.use(AuthMiddleware.authenticate);
router.get('/', async (req, res) => {
  try {
    const rates = await CylinderRateService.getAllRates(req.query);
    return ResponseUtil.success(res, rates, 'Rates fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rate = await CylinderRateService.getRateById(req.params.id);
    if (!rate) return ResponseUtil.notFound(res, 'Rate not found');
    return ResponseUtil.success(res, rate, 'Rate fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.post('/', async (req, res) => {
  try {
    const rateId = await CylinderRateService.createRate(req.body);
    const rate = await CylinderRateService.getRateById(rateId);
    return ResponseUtil.created(res, rate, 'Rate created successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.put('/:id', async (req, res) => {
  try {
    await CylinderRateService.updateRate(req.params.id, req.body);
    const rate = await CylinderRateService.getRateById(req.params.id);
    return ResponseUtil.success(res, rate, 'Rate updated successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await CylinderRateService.deleteRate(req.params.id);
    return ResponseUtil.success(res, null, 'Rate deleted successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

module.exports = router;