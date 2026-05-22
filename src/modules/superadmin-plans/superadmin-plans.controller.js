const SuperadminPlansService = require('./superadmin-plans.service');
const ResponseUtil = require('../../utils/response');
const logger = require('../../config/logger');

class SuperadminPlansController {
  async getAllPlans(req, res) {
    try {
      const filters = {
        is_active: req.query.is_active,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit
      };
      
      const result = await SuperadminPlansService.getAllPlans(filters);
      return ResponseUtil.success(res, result, 'Plans fetched successfully');
    } catch (error) {
      logger.error('Get all plans error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async getPlanById(req, res) {
    try {
      const plan = await SuperadminPlansService.getPlanById(req.params.id);
      if (!plan) {
        return ResponseUtil.notFound(res, 'Plan not found');
      }
      return ResponseUtil.success(res, plan, 'Plan fetched successfully');
    } catch (error) {
      logger.error('Get plan by id error:', error);
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  async createPlan(req, res) {
    try {
      const planId = await SuperadminPlansService.createPlan(req.body);
      const plan = await SuperadminPlansService.getPlanById(planId);
      return ResponseUtil.created(res, plan, 'Plan created successfully');
    } catch (error) {
      logger.error('Create plan error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async updatePlan(req, res) {
    try {
      await SuperadminPlansService.updatePlan(req.params.id, req.body);
      const plan = await SuperadminPlansService.getPlanById(req.params.id);
      return ResponseUtil.success(res, plan, 'Plan updated successfully');
    } catch (error) {
      logger.error('Update plan error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async togglePlanStatus(req, res) {
    try {
      const { is_active } = req.body;
      await SuperadminPlansService.togglePlanStatus(req.params.id, is_active);
      const plan = await SuperadminPlansService.getPlanById(req.params.id);
      return ResponseUtil.success(res, plan, `Plan ${is_active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      logger.error('Toggle plan status error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }

  async deletePlan(req, res) {
    try {
      await SuperadminPlansService.deletePlan(req.params.id);
      return ResponseUtil.success(res, null, 'Plan deleted successfully');
    } catch (error) {
      logger.error('Delete plan error:', error);
      return ResponseUtil.error(res, error.message, 400);
    }
  }
}

module.exports = new SuperadminPlansController();