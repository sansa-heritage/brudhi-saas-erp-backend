const express = require('express');
const router = express.Router();
const BrandService = require('./brand.service');
const ResponseUtil = require('../../utils/response');
const AuthMiddleware = require('../../middlewares/auth.middleware');

router.get('/dropdown', async (req, res) => {
  try {
    const brands = await BrandService.getAllBrands({ status: 1 });
    return ResponseUtil.success(res, brands, 'Brands fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.use(AuthMiddleware.authenticate);
router.get('/', async (req, res) => {
  try {
    const brands = await BrandService.getAllBrands(req.query);
    return ResponseUtil.success(res, brands, 'Brands fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const brand = await BrandService.getBrandById(req.params.id);
    if (!brand) return ResponseUtil.notFound(res, 'Brand not found');
    return ResponseUtil.success(res, brand, 'Brand fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.post('/', async (req, res) => {
  try {
    const brandId = await BrandService.createBrand(req.body);
    const brand = await BrandService.getBrandById(brandId);
    return ResponseUtil.created(res, brand, 'Brand created successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.put('/:id', async (req, res) => {
  try {
    await BrandService.updateBrand(req.params.id, req.body);
    const brand = await BrandService.getBrandById(req.params.id);
    return ResponseUtil.success(res, brand, 'Brand updated successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await BrandService.deleteBrand(req.params.id);
    return ResponseUtil.success(res, null, 'Brand deleted successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

module.exports = router;