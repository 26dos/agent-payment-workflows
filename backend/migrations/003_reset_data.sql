-- ClawPay 测试环境数据清理脚本
-- 执行后：清空所有业务数据，保留表结构，从头验证
-- 用法: psql -h localhost -U clawpay -d clawpay -f backend/migrations/003_reset_data.sql

BEGIN;

-- 清空所有业务表并重置自增 ID（CASCADE 处理外键）
TRUNCATE TABLE
  disputes,
  activity_logs,
  reputation_history,
  tasks,
  agents,
  users,
  batch_chain_config
RESTART IDENTITY CASCADE;

-- 恢复批量上链默认配置
INSERT INTO batch_chain_config (task_count, interval_minutes, auto_enabled)
VALUES (10, 60, false);

COMMIT;

-- 清理完成
SELECT 'Data reset done. Tables are empty, sequences reset.' AS status;
