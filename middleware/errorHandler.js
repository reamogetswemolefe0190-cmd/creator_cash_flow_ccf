// ==========================================================================
// Creator Cash Flow - Centralized Error & 404 Handling Middleware
// ==========================================================================

function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        code: 'ROUTE_NOT_FOUND'
    });
}

function errorHandler(err, req, res, next) {
    if (err && (err.message === 'Blocked by CORS policy' || err.status === 403)) {
        return res.status(403).json({
            success: false,
            error: 'Blocked by CORS policy',
            code: 'CORS_ERROR'
        });
    }

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON payload',
            code: 'INVALID_JSON'
        });
    }

    const status = err.status || 500;
    return res.status(status).json({
        success: false,
        error: status === 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
        code: err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR')
    });
}

module.exports = {
    notFoundHandler,
    errorHandler
};
