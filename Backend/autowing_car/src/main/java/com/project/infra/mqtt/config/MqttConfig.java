package com.project.infra.mqtt.config;

import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;

@Configuration
public class MqttConfig {

    @Value("${spring.mqtt.broker.url}")
    private String brokerUrl;

    // @Value("${spring.mqtt.username:}") // 없을 경우 빈 문자열
    // private String username;

    // @Value("${spring.mqtt.password:}") // 없을 경우 빈 문자열
    // private String password;

    // MQTT 클라이언트 팩토리 빈 생성
    /*
     * 역할 : MQTT 클라이언트의 생성과 설정을 담당하는 공장(Factory) 역할
     * - MQTT 브로커 URL 설정
     * - (옵션) 인증 정보 설정 (아이디/비번)
     * - 연결 옵션 설정 (자동 재접속, 클린 세션 등)
     */
    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();

        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[] { brokerUrl }); // 👈 여기에 URL을 넣습니다!

        // 아이디/비번이 있는 경우 설정
        // if (!username.isBlank()) {
        // options.setUserName(username);
        // options.setPassword(password.toCharArray());
        // }

        // 중요: 연결 설정 (접속 끊겨도 자동 재접속 등)
        options.setAutomaticReconnect(true);
        options.setCleanSession(true); // 서버는 보통 true로 씁니다 (메시지 쌓아둘 필요 없음)
        options.setConnectionTimeout(10);
        options.setKeepAliveInterval(30);

        factory.setConnectionOptions(options); // 👈 공장에 옵션 주입 완료
        return factory;
    }
}