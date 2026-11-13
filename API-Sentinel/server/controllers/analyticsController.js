/**
 * API Sentinel - Analytics Controller
 * Computes live metrics, aggregation statistics, failure distributions, and trend charts.
 */

const { Workflow, Execution, FailureLog } = require('../models');

class AnalyticsController {
  static async getDashboardStats(req, res, next) {
    try {
      const ownerId = String(req.user.id);

      // 1. Fetch user records
      const workflowsResult = await Workflow.find({ ownerId });
      const workflows = Array.isArray(workflowsResult) ? workflowsResult : await workflowsResult.exec();

      const executionsResult = await Execution.find({ ownerId });
      const executions = Array.isArray(executionsResult) ? executionsResult : await executionsResult.exec();

      const failureLogsResult = await FailureLog.find({ ownerId });
      const failureLogs = Array.isArray(failureLogsResult) ? failureLogsResult : await failureLogsResult.exec();

      // 2. Compute Aggregates
      const totalWorkflows = workflows.length;
      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.status === 'COMPLETED').length;
      const failedExecutions = executions.filter(e => e.status === 'FAILED').length;
      const cancelledExecutions = executions.filter(e => e.status === 'CANCELLED').length;

      let totalApiRequests = 0;
      let totalDurationMs = 0;
      let responseTimeSamples = 0;

      for (const exec of executions) {
        if (Array.isArray(exec.steps)) {
          totalApiRequests += exec.steps.length;
          for (const s of exec.steps) {
            if (s.response && s.response.durationMs) {
              totalDurationMs += s.response.durationMs;
              responseTimeSamples++;
            }
          }
        }
      }

      const averageResponseTime = responseTimeSamples > 0 ? Math.round(totalDurationMs / responseTimeSamples) : 0;
      const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 100;
      const recoveryAttempts = failureLogs.filter(f => f.recoveryAction === 'RETRY' || f.retryCount > 0).length;

      // 3. Failure Distribution by Type
      const failureDistributionMap = {};
      for (const log of failureLogs) {
        const type = log.failureType || 'UNKNOWN';
        if (type !== 'RECOVERY_ACTION') {
          failureDistributionMap[type] = (failureDistributionMap[type] || 0) + 1;
        }
      }
      const failureDistribution = Object.entries(failureDistributionMap).map(([name, count]) => ({
        name,
        count,
      }));

      // 4. Trend Data (Grouped by Date)
      const trendMap = {};
      const now = new Date();
      // Initialize last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        trendMap[key] = { date: key, total: 0, successful: 0, failed: 0, avgDuration: 0, durations: [] };
      }

      for (const exec of executions) {
        const dateKey = (exec.startTime || exec.createdAt ? new Date(exec.startTime || exec.createdAt) : new Date())
          .toISOString()
          .split('T')[0];

        if (!trendMap[dateKey]) {
          trendMap[dateKey] = { date: dateKey, total: 0, successful: 0, failed: 0, avgDuration: 0, durations: [] };
        }

        trendMap[dateKey].total++;
        if (exec.status === 'COMPLETED') trendMap[dateKey].successful++;
        if (exec.status === 'FAILED') trendMap[dateKey].failed++;
        if (exec.duration) trendMap[dateKey].durations.push(exec.duration);
      }

      const trendChart = Object.values(trendMap).map(day => {
        const avg = day.durations.length > 0
          ? Math.round(day.durations.reduce((a, b) => a + b, 0) / day.durations.length)
          : 0;
        return {
          date: day.date,
          total: day.total,
          successful: day.successful,
          failed: day.failed,
          avgDuration: avg,
        };
      });

      // 5. Recent items
      const recentExecutions = [...executions]
        .sort((a, b) => new Date(b.startTime || b.createdAt) - new Date(a.startTime || a.createdAt))
        .slice(0, 8);

      const recentFailures = [...failureLogs]
        .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
        .slice(0, 8);

      res.json({
        totalWorkflows,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        cancelledExecutions,
        totalApiRequests,
        recoveryAttempts,
        averageResponseTime,
        successRate,
        failureDistribution,
        trendChart,
        recentExecutions,
        recentFailures,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AnalyticsController;

