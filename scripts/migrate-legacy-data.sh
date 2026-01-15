#!/bin/bash
# ============================================
# Legacy Data Migration Script
# nexus-coder-db → dashboard-db
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Legacy Data Migration Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Legacy DB (nexus-coder)
LEGACY_HOST="localhost"
LEGACY_PORT="4091"
LEGACY_USER="nexuscoder"
LEGACY_PASS="nexuscoder123"
LEGACY_DB="nexuscoder"

# New DB (dashboard)
NEW_HOST="localhost"
NEW_PORT="4081"
NEW_USER="ax"
NEW_PASS="ax123"
NEW_DB="axdashboard"

# Export for psql
export PGPASSWORD="$LEGACY_PASS"

echo -e "\n${YELLOW}Step 1: Check legacy database connection...${NC}"
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "SELECT COUNT(*) as user_count FROM users;" || {
    echo -e "${RED}Failed to connect to legacy database${NC}"
    exit 1
}
echo -e "${GREEN}✓ Legacy database connected${NC}"

export PGPASSWORD="$NEW_PASS"

echo -e "\n${YELLOW}Step 2: Check new database connection...${NC}"
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "SELECT 1;" || {
    echo -e "${RED}Failed to connect to new database${NC}"
    exit 1
}
echo -e "${GREEN}✓ New database connected${NC}"

echo -e "\n${YELLOW}Step 3: Create nexus-coder service in new DB...${NC}"
SERVICE_ID=$(psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -t -A -c "
INSERT INTO services (id, name, \"displayName\", description, enabled, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'nexus-coder',
    'Nexus Coder',
    'AI Code Assistant Service (migrated from legacy)',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
RETURNING id;
")
SERVICE_ID=$(echo $SERVICE_ID | tr -d '[:space:]')
echo -e "${GREEN}✓ Service ID: $SERVICE_ID${NC}"

echo -e "\n${YELLOW}Step 4: Export data from legacy DB...${NC}"

# Create temp directory
TEMP_DIR="/tmp/migration_$(date +%Y%m%d_%H%M%S)"
mkdir -p $TEMP_DIR

export PGPASSWORD="$LEGACY_PASS"

# Export users
echo "  Exporting users..."
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "\COPY (SELECT id, loginid, username, deptname, \"firstSeen\", \"lastActive\", \"isActive\" FROM users) TO '$TEMP_DIR/users.csv' WITH CSV HEADER"

# Export admins (will need role conversion)
echo "  Exporting admins..."
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "\COPY (SELECT id, loginid, role, \"createdAt\" FROM admins) TO '$TEMP_DIR/admins.csv' WITH CSV HEADER"

# Export models
echo "  Exporting models..."
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "\COPY (SELECT id, name, \"displayName\", \"endpointUrl\", \"apiKey\", \"maxTokens\", enabled, \"createdAt\", \"createdBy\" FROM models) TO '$TEMP_DIR/models.csv' WITH CSV HEADER"

# Export usage_logs
echo "  Exporting usage_logs..."
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "\COPY (SELECT id, user_id, model_id, \"inputTokens\", \"outputTokens\", \"totalTokens\", timestamp FROM usage_logs) TO '$TEMP_DIR/usage_logs.csv' WITH CSV HEADER"

# Export daily_usage_stats
echo "  Exporting daily_usage_stats..."
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "\COPY (SELECT id, date, user_id, model_id, deptname, \"totalInputTokens\", \"totalOutputTokens\", \"requestCount\" FROM daily_usage_stats) TO '$TEMP_DIR/daily_usage_stats.csv' WITH CSV HEADER"

# Export feedbacks
echo "  Exporting feedbacks..."
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "\COPY (SELECT id, user_id, category, title, content, images, status, response, responded_by, responded_at, created_at, updated_at FROM feedbacks) TO '$TEMP_DIR/feedbacks.csv' WITH CSV HEADER"

# Export feedback_comments
echo "  Exporting feedback_comments..."
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "\COPY (SELECT id, feedback_id, admin_id, content, created_at, updated_at FROM feedback_comments) TO '$TEMP_DIR/feedback_comments.csv' WITH CSV HEADER" 2>/dev/null || echo "  (No feedback_comments table or empty)"

# Export rating_feedbacks
echo "  Exporting rating_feedbacks..."
psql -h $LEGACY_HOST -p $LEGACY_PORT -U $LEGACY_USER -d $LEGACY_DB -c "\COPY (SELECT id, model_name, rating, timestamp FROM rating_feedbacks) TO '$TEMP_DIR/rating_feedbacks.csv' WITH CSV HEADER"

echo -e "${GREEN}✓ Data exported to $TEMP_DIR${NC}"

echo -e "\n${YELLOW}Step 5: Import data to new DB...${NC}"

export PGPASSWORD="$NEW_PASS"

# Import users (add business_unit column)
echo "  Importing users..."
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
CREATE TEMP TABLE tmp_users (
    id UUID, loginid TEXT, username TEXT, deptname TEXT,
    \"firstSeen\" TIMESTAMP, \"lastActive\" TIMESTAMP, \"isActive\" BOOLEAN
);
\COPY tmp_users FROM '$TEMP_DIR/users.csv' WITH CSV HEADER;
INSERT INTO users (id, loginid, username, deptname, business_unit, \"firstSeen\", \"lastActive\", \"isActive\")
SELECT id, loginid, username, deptname,
       CASE WHEN deptname != '' THEN SPLIT_PART(deptname, '/', 1) ELSE NULL END,
       \"firstSeen\", \"lastActive\", \"isActive\"
FROM tmp_users
ON CONFLICT (loginid) DO UPDATE SET
    username = EXCLUDED.username,
    deptname = EXCLUDED.deptname,
    business_unit = EXCLUDED.business_unit,
    \"lastActive\" = EXCLUDED.\"lastActive\";
DROP TABLE tmp_users;
"

# Import admins (convert ADMIN → SERVICE_ADMIN)
echo "  Importing admins (converting roles)..."
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
CREATE TEMP TABLE tmp_admins (
    id UUID, loginid TEXT, role TEXT, \"createdAt\" TIMESTAMP
);
\COPY tmp_admins FROM '$TEMP_DIR/admins.csv' WITH CSV HEADER;
INSERT INTO admins (id, loginid, role, \"createdAt\")
SELECT id, loginid,
       CASE
           WHEN role = 'ADMIN' THEN 'SERVICE_ADMIN'::\"AdminRole\"
           WHEN role = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::\"AdminRole\"
           WHEN role = 'VIEWER' THEN 'VIEWER'::\"AdminRole\"
           ELSE 'SERVICE_ADMIN'::\"AdminRole\"
       END,
       \"createdAt\"
FROM tmp_admins
ON CONFLICT (loginid) DO UPDATE SET
    role = EXCLUDED.role;
DROP TABLE tmp_admins;
"

# Import models (add service_id)
echo "  Importing models..."
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
CREATE TEMP TABLE tmp_models (
    id UUID, name TEXT, \"displayName\" TEXT, \"endpointUrl\" TEXT,
    \"apiKey\" TEXT, \"maxTokens\" INT, enabled BOOLEAN,
    \"createdAt\" TIMESTAMP, \"createdBy\" UUID
);
\COPY tmp_models FROM '$TEMP_DIR/models.csv' WITH CSV HEADER;
INSERT INTO models (id, name, \"displayName\", \"endpointUrl\", \"apiKey\", \"maxTokens\", enabled, \"createdAt\", \"createdBy\", service_id)
SELECT id, name, \"displayName\", \"endpointUrl\", \"apiKey\", \"maxTokens\", enabled, \"createdAt\", \"createdBy\", '$SERVICE_ID'::uuid
FROM tmp_models
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    \"displayName\" = EXCLUDED.\"displayName\",
    service_id = '$SERVICE_ID'::uuid;
DROP TABLE tmp_models;
"

# Import usage_logs (add service_id)
echo "  Importing usage_logs (this may take a while)..."
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
CREATE TEMP TABLE tmp_usage_logs (
    id UUID, user_id UUID, model_id UUID,
    \"inputTokens\" INT, \"outputTokens\" INT, \"totalTokens\" INT,
    timestamp TIMESTAMP
);
\COPY tmp_usage_logs FROM '$TEMP_DIR/usage_logs.csv' WITH CSV HEADER;
INSERT INTO usage_logs (id, user_id, model_id, \"inputTokens\", \"outputTokens\", \"totalTokens\", timestamp, service_id)
SELECT id, user_id, model_id, \"inputTokens\", \"outputTokens\", \"totalTokens\", timestamp, '$SERVICE_ID'::uuid
FROM tmp_usage_logs
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_usage_logs;
"

# Import daily_usage_stats (add service_id)
echo "  Importing daily_usage_stats..."
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
CREATE TEMP TABLE tmp_daily_stats (
    id UUID, date DATE, user_id UUID, model_id UUID, deptname TEXT,
    \"totalInputTokens\" INT, \"totalOutputTokens\" INT, \"requestCount\" INT
);
\COPY tmp_daily_stats FROM '$TEMP_DIR/daily_usage_stats.csv' WITH CSV HEADER;
INSERT INTO daily_usage_stats (id, date, user_id, model_id, deptname, \"totalInputTokens\", \"totalOutputTokens\", \"requestCount\", service_id)
SELECT id, date, user_id, model_id, deptname, \"totalInputTokens\", \"totalOutputTokens\", \"requestCount\", '$SERVICE_ID'::uuid
FROM tmp_daily_stats
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_daily_stats;
"

# Import feedbacks (add service_id)
echo "  Importing feedbacks..."
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
CREATE TEMP TABLE tmp_feedbacks (
    id UUID, user_id UUID, category TEXT, title TEXT, content TEXT,
    images TEXT[], status TEXT, response TEXT, responded_by UUID,
    responded_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP
);
\COPY tmp_feedbacks FROM '$TEMP_DIR/feedbacks.csv' WITH CSV HEADER;
INSERT INTO feedbacks (id, user_id, category, title, content, images, status, response, responded_by, responded_at, created_at, updated_at, service_id)
SELECT id, user_id, category::\"FeedbackCategory\", title, content, images, status::\"FeedbackStatus\", response, responded_by, responded_at, created_at, updated_at, '$SERVICE_ID'::uuid
FROM tmp_feedbacks
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_feedbacks;
"

# Import feedback_comments
echo "  Importing feedback_comments..."
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
CREATE TEMP TABLE tmp_comments (
    id UUID, feedback_id UUID, admin_id UUID, content TEXT,
    created_at TIMESTAMP, updated_at TIMESTAMP
);
\COPY tmp_comments FROM '$TEMP_DIR/feedback_comments.csv' WITH CSV HEADER;
INSERT INTO feedback_comments (id, feedback_id, admin_id, content, created_at, updated_at)
SELECT id, feedback_id, admin_id, content, created_at, updated_at
FROM tmp_comments
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_comments;
" 2>/dev/null || echo "  (Skipped - no data)"

# Import rating_feedbacks (add service_id)
echo "  Importing rating_feedbacks..."
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
CREATE TEMP TABLE tmp_ratings (
    id UUID, model_name TEXT, rating INT, timestamp TIMESTAMP
);
\COPY tmp_ratings FROM '$TEMP_DIR/rating_feedbacks.csv' WITH CSV HEADER;
INSERT INTO rating_feedbacks (id, model_name, rating, timestamp, service_id)
SELECT id, model_name, rating, timestamp, '$SERVICE_ID'::uuid
FROM tmp_ratings
ON CONFLICT (id) DO NOTHING;
DROP TABLE tmp_ratings;
"

echo -e "${GREEN}✓ Data imported${NC}"

echo -e "\n${YELLOW}Step 6: Create UserService records from usage_logs...${NC}"
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
INSERT INTO user_services (id, user_id, service_id, first_seen, last_active, request_count)
SELECT
    gen_random_uuid(),
    user_id,
    service_id,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_active,
    COUNT(*) as request_count
FROM usage_logs
WHERE service_id IS NOT NULL
GROUP BY user_id, service_id
ON CONFLICT (user_id, service_id) DO UPDATE SET
    last_active = EXCLUDED.last_active,
    request_count = EXCLUDED.request_count;
"
echo -e "${GREEN}✓ UserService records created${NC}"

echo -e "\n${YELLOW}Step 7: Verify migration...${NC}"
echo "  Counting records in new database:"
psql -h $NEW_HOST -p $NEW_PORT -U $NEW_USER -d $NEW_DB -c "
SELECT 'services' as table_name, COUNT(*) as count FROM services
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'admins', COUNT(*) FROM admins
UNION ALL SELECT 'models', COUNT(*) FROM models
UNION ALL SELECT 'usage_logs', COUNT(*) FROM usage_logs
UNION ALL SELECT 'daily_usage_stats', COUNT(*) FROM daily_usage_stats
UNION ALL SELECT 'feedbacks', COUNT(*) FROM feedbacks
UNION ALL SELECT 'rating_feedbacks', COUNT(*) FROM rating_feedbacks
UNION ALL SELECT 'user_services', COUNT(*) FROM user_services;
"

# Cleanup
echo -e "\n${YELLOW}Step 8: Cleanup temp files...${NC}"
rm -rf $TEMP_DIR
echo -e "${GREEN}✓ Temp files removed${NC}"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Migration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Service ID: ${YELLOW}$SERVICE_ID${NC}"
echo -e "All legacy data has been migrated with this service ID."
