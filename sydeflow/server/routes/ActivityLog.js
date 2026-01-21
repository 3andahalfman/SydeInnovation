/**
 * ActivityLog.js - Global Activity Tracking Service
 * 
 * Aggregates and emits activity events from all platform services:
 * - File Sync events
 * - OSS operations
 * - Design Automation work items
 * - Product changes
 */

const express = require('express');
const router = express.Router();
const _fs = require('fs');
const _path = require('path');

// In-memory activity log (last 100 entries)
let activityLog = [];
const MAX_ACTIVITY_LOG = 100;

// Activity types
const ActivityType = {
    // File Sync
    SYNC_STARTED: 'sync:started',
    SYNC_COMPLETED: 'sync:completed',
    SYNC_ERROR: 'sync:error',
    SYNC_CONFIG_CREATED: 'sync:config:created',
    SYNC_CONFIG_UPDATED: 'sync:config:updated',
    SYNC_CONFIG_DELETED: 'sync:config:deleted',
    
    // OSS Operations
    OSS_BUCKET_CREATED: 'oss:bucket:created',
    OSS_BUCKET_DELETED: 'oss:bucket:deleted',
    OSS_OBJECT_UPLOADED: 'oss:object:uploaded',
    OSS_OBJECT_DELETED: 'oss:object:deleted',
    OSS_OBJECT_TRANSLATED: 'oss:object:translated',
    
    // Design Automation
    DA_BUNDLE_CREATED: 'da:bundle:created',
    DA_BUNDLE_DELETED: 'da:bundle:deleted',
    DA_ACTIVITY_CREATED: 'da:activity:created',
    DA_ACTIVITY_DELETED: 'da:activity:deleted',
    DA_WORKITEM_STARTED: 'da:workitem:started',
    DA_WORKITEM_COMPLETED: 'da:workitem:completed',
    DA_WORKITEM_FAILED: 'da:workitem:failed',
    
    // Products
    PRODUCT_CREATED: 'product:created',
    PRODUCT_UPDATED: 'product:updated',
    PRODUCT_DELETED: 'product:deleted',
    
    // System
    SERVER_STARTED: 'system:started',
    USER_AUTHENTICATED: 'auth:login',
    USER_LOGOUT: 'auth:logout'
};

// Activity categories for UI grouping
const ActivityCategory = {
    SYNC: 'File Sync',
    OSS: 'Object Storage',
    DA: 'Design Automation',
    PRODUCT: 'Products',
    SYSTEM: 'System'
};

// Activity log file path
const ACTIVITY_LOG_PATH = _path.join(__dirname, '../data/activity-log.json');

// Load existing activity log
try {
    if (_fs.existsSync(ACTIVITY_LOG_PATH)) {
        const data = JSON.parse(_fs.readFileSync(ACTIVITY_LOG_PATH, 'utf8'));
        activityLog = data.activities || [];
    }
} catch (err) {
    console.log('No existing activity log found, starting fresh');
}

// Save activity log to file
const saveActivityLog = () => {
    try {
        // Ensure data directory exists
        const dataDir = _path.dirname(ACTIVITY_LOG_PATH);
        if (!_fs.existsSync(dataDir)) {
            _fs.mkdirSync(dataDir, { recursive: true });
        }
        _fs.writeFileSync(ACTIVITY_LOG_PATH, JSON.stringify({
            activities: activityLog,
            lastUpdated: new Date().toISOString()
        }, null, 2));
    } catch (err) {
        console.error('Failed to save activity log:', err);
    }
};

// Get Socket.IO instance
const getIO = () => global.socketIO;

/**
 * Log an activity and emit to connected clients
 */
const logActivity = (type, data) => {
    const activity = {
        id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        category: getCategory(type),
        timestamp: new Date().toISOString(),
        ...data
    };
    
    // Add to log
    activityLog.unshift(activity);
    if (activityLog.length > MAX_ACTIVITY_LOG) {
        activityLog = activityLog.slice(0, MAX_ACTIVITY_LOG);
    }
    
    // Save to file
    saveActivityLog();
    
    // Emit to connected clients
    const io = getIO();
    if (io) {
        io.emit('activity:new', activity);
    }
    
    console.log(`📋 Activity: ${type} - ${data.message || data.title || ''}`);
    
    return activity;
};

/**
 * Get category from activity type
 */
const getCategory = (type) => {
    if (type.startsWith('sync:')) return ActivityCategory.SYNC;
    if (type.startsWith('oss:')) return ActivityCategory.OSS;
    if (type.startsWith('da:')) return ActivityCategory.DA;
    if (type.startsWith('product:')) return ActivityCategory.PRODUCT;
    return ActivityCategory.SYSTEM;
};

/**
 * Get icon name for activity type
 */
const getActivityIcon = (type) => {
    const iconMap = {
        'sync:started': 'RefreshCw',
        'sync:completed': 'CheckCircle',
        'sync:error': 'XCircle',
        'sync:config:created': 'Plus',
        'sync:config:updated': 'Edit',
        'sync:config:deleted': 'Trash2',
        'oss:bucket:created': 'FolderPlus',
        'oss:bucket:deleted': 'FolderMinus',
        'oss:object:uploaded': 'Upload',
        'oss:object:deleted': 'Trash2',
        'oss:object:translated': 'Layers',
        'da:bundle:created': 'Package',
        'da:bundle:deleted': 'PackageX',
        'da:activity:created': 'Zap',
        'da:activity:deleted': 'ZapOff',
        'da:workitem:started': 'Play',
        'da:workitem:completed': 'CheckCircle',
        'da:workitem:failed': 'XCircle',
        'product:created': 'Box',
        'product:updated': 'Edit',
        'product:deleted': 'Trash2',
        'system:started': 'Server',
        'auth:login': 'LogIn',
        'auth:logout': 'LogOut'
    };
    return iconMap[type] || 'Activity';
};

/**
 * Get color for activity type
 */
const getActivityColor = (type) => {
    if (type.includes('error') || type.includes('failed') || type.includes('deleted')) {
        return 'red';
    }
    if (type.includes('completed') || type.includes('created')) {
        return 'green';
    }
    if (type.includes('started') || type.includes('processing')) {
        return 'yellow';
    }
    if (type.includes('updated')) {
        return 'blue';
    }
    return 'gray';
};

// ============================================
// REST API ENDPOINTS
// ============================================

/**
 * Get activity log
 */
router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const category = req.query.category;
    
    let filtered = activityLog;
    if (category) {
        filtered = activityLog.filter(a => a.category === category);
    }
    
    res.json({
        activities: filtered.slice(0, limit),
        total: filtered.length,
        categories: Object.values(ActivityCategory)
    });
});

/**
 * Get activity by ID
 */
router.get('/:id', (req, res) => {
    const activity = activityLog.find(a => a.id === req.params.id);
    if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
    }
    res.json(activity);
});

/**
 * Clear activity log
 */
router.delete('/', (req, res) => {
    activityLog = [];
    saveActivityLog();
    
    const io = getIO();
    if (io) {
        io.emit('activity:cleared');
    }
    
    res.json({ status: 'cleared' });
});

/**
 * Get activity stats
 */
router.get('/stats/summary', (req, res) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const todayActivities = activityLog.filter(a => new Date(a.timestamp) >= today);
    const weekActivities = activityLog.filter(a => new Date(a.timestamp) >= weekAgo);
    
    const categoryStats = {};
    Object.values(ActivityCategory).forEach(cat => {
        categoryStats[cat] = activityLog.filter(a => a.category === cat).length;
    });
    
    res.json({
        total: activityLog.length,
        today: todayActivities.length,
        thisWeek: weekActivities.length,
        byCategory: categoryStats,
        lastActivity: activityLog[0] || null
    });
});

// Export module with utilities
module.exports = router;
module.exports.logActivity = logActivity;
module.exports.ActivityType = ActivityType;
module.exports.ActivityCategory = ActivityCategory;
module.exports.getActivityIcon = getActivityIcon;
module.exports.getActivityColor = getActivityColor;
