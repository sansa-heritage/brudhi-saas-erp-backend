const express = require('express');
const router = express.Router();
const CylinderTypeService = require('./cylinder-type.service');
const ResponseUtil = require('../../utils/response');
const AuthMiddleware = require('../../middlewares/auth.middleware');

router.get('/dropdown', async (req, res) => {
  try {
    const types = await CylinderTypeService.getAllCylinderTypes({ 
      type: req.query.type,
      status: 1 
    });
    return ResponseUtil.success(res, types, 'Cylinder types fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.use(AuthMiddleware.authenticate);
router.get('/', async (req, res) => {
  try {
    const types = await CylinderTypeService.getAllCylinderTypes(req.query);
    return ResponseUtil.success(res, types, 'Cylinder types fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const type = await CylinderTypeService.getCylinderTypeById(req.params.id);
    if (!type) return ResponseUtil.notFound(res, 'Cylinder type not found');
    return ResponseUtil.success(res, type, 'Cylinder type fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.post('/', async (req, res) => {
  try {
    const typeId = await CylinderTypeService.createCylinderType(req.body);
    const type = await CylinderTypeService.getCylinderTypeById(typeId);
    return ResponseUtil.created(res, type, 'Cylinder type created successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.put('/:id', async (req, res) => {
  try {
    await CylinderTypeService.updateCylinderType(req.params.id, req.body);
    const type = await CylinderTypeService.getCylinderTypeById(req.params.id);
    return ResponseUtil.success(res, type, 'Cylinder type updated successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await CylinderTypeService.deleteCylinderType(req.params.id);
    return ResponseUtil.success(res, null, 'Cylinder type deleted successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

module.exports = router;