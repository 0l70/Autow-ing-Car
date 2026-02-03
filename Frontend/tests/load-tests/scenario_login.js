import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, TEST_USERS, THRESHOLDS } from './config.js';

export const options = {
    stages: [
        { duration: '30s', target: 200 }, // Warm-up
        { duration: '1m', target: 1000 }, // Load
        { duration: '30s', target: 0 },   // Cool-down
    ],
    thresholds: THRESHOLDS,
};

export default function () {
    const payload = JSON.stringify({
        email: TEST_USERS.PILOT.email,
        password: TEST_USERS.PILOT.password,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);

    // 검증
    check(res, {
        'status is 200': (r) => r.status === 200,
        'has access token': (r) => {
            const body = r.json();
            return body && body.accessToken !== undefined;
        },
    });

    sleep(1);
}
