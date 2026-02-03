import http from 'k6/http';
import { BASE_URL, TEST_USERS } from './config.js';

export default function () {
    const payload = JSON.stringify({
        email: TEST_USERS.ADMIN.email,
        password: TEST_USERS.ADMIN.password,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);

    if (res.status === 200) {
        console.log("---------------------------------------------------");
        console.log("✅ 유효한 소켓 토큰 (아래 내용을 복사해서 사용하세요):");
        console.log(res.json('socketToken'));
        console.log("---------------------------------------------------");
    } else {
        console.error("❌ 토큰 발급 실패: " + res.status + " " + res.body);
    }
}
