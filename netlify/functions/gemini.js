// Netlify Functions Entrypoint Proxy
const handler = require('../../api/gemini.js');

const ALLOWED_ORIGINS = [
    'https://creatorcashflow.co.za',
    'https://www.creatorcashflow.co.za',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000'
];

exports.handler = async (event, context) => {
    const origin = event.headers ? (event.headers.origin || event.headers.Origin) : null;
    const isAllowedOrigin = !origin || ALLOWED_ORIGINS.includes(origin);

    if (origin && !isAllowedOrigin) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Blocked by CORS policy' })
        };
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch(e) {}

    let responseData = {};
    let statusCode = 200;
    const responseHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin && isAllowedOrigin ? origin : 'https://creatorcashflow.co.za',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    };

    const resMock = {
        setHeader: (key, val) => {
            responseHeaders[key] = val;
        },
        status: (code) => {
            statusCode = code;
            return {
                json: (data) => { responseData = data; },
                end: () => {}
            };
        }
    };

    const reqMock = {
        method: event.httpMethod,
        headers: event.headers || {},
        body: body
    };

    await handler(reqMock, resMock);

    return {
        statusCode: statusCode,
        headers: responseHeaders,
        body: JSON.stringify(responseData)
    };
};
