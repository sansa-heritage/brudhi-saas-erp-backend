const express = require('express');
const router = express.Router();
const PincodeService = require('./pincode.service');
const ResponseUtil = require('../../utils/response');
const AuthMiddleware = require('../../middlewares/auth.middleware');

router.get('/search', async (req, res) => {
  try {
    const pincode = await PincodeService.getPincodeByCode(req.query.code);
    return ResponseUtil.success(res, pincode, 'Pincode fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.use(AuthMiddleware.authenticate);
router.get('/', async (req, res) => {
  try {
    const pincodes = await PincodeService.getAllPincodes(req.query);
    return ResponseUtil.success(res, pincodes, 'Pincodes fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pincode = await PincodeService.getPincodeById(req.params.id);
    if (!pincode) return ResponseUtil.notFound(res, 'Pincode not found');
    return ResponseUtil.success(res, pincode, 'Pincode fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.post('/', async (req, res) => {
  try {
    const pincodeId = await PincodeService.createPincode(req.body);
    const pincode = await PincodeService.getPincodeById(pincodeId);
    return ResponseUtil.created(res, pincode, 'Pincode created successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.put('/:id', async (req, res) => {
  try {
    await PincodeService.updatePincode(req.params.id, req.body);
    const pincode = await PincodeService.getPincodeById(req.params.id);
    return ResponseUtil.success(res, pincode, 'Pincode updated successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await PincodeService.deletePincode(req.params.id);
    return ResponseUtil.success(res, null, 'Pincode deleted successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

module.exports = router;