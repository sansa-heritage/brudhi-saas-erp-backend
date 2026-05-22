const express = require('express');
const router = express.Router();
const StateService = require('./state.service');
const ResponseUtil = require('../../utils/response');
const AuthMiddleware = require('../../middlewares/auth.middleware');

router.get('/dropdown', async (req, res) => {
  try {
    const states = await StateService.getAllStates({ countryId: req.query.countryId });
    return ResponseUtil.success(res, states, 'States fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.use(AuthMiddleware.authenticate);
router.get('/', async (req, res) => {
  try {
    const states = await StateService.getAllStates(req.query);
    return ResponseUtil.success(res, states, 'States fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const state = await StateService.getStateById(req.params.id);
    if (!state) return ResponseUtil.notFound(res, 'State not found');
    return ResponseUtil.success(res, state, 'State fetched successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 500);
  }
});

router.post('/', async (req, res) => {
  try {
    const stateId = await StateService.createState(req.body);
    const state = await StateService.getStateById(stateId);
    return ResponseUtil.created(res, state, 'State created successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.put('/:id', async (req, res) => {
  try {
    await StateService.updateState(req.params.id, req.body);
    const state = await StateService.getStateById(req.params.id);
    return ResponseUtil.success(res, state, 'State updated successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await StateService.deleteState(req.params.id);
    return ResponseUtil.success(res, null, 'State deleted successfully');
  } catch (error) {
    return ResponseUtil.error(res, error.message, 400);
  }
});

module.exports = router;