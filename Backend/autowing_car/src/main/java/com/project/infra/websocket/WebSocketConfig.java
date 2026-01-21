package com.project.infra.websocket;

import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
@Configuration
@EnableWebSocketMessageBroker // 👈 필수
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer{
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // .withSockJS()를 쓰려면 의존성이 완벽해야 하므로, 일단 빼고 순수 ws로 테스트해보는 것도 방법입니다.
        registry.addEndpoint("/ws-server")
                .setAllowedOriginPatterns(
                    "http://localhost:3000",
                    "http://127.0.0.1:3000"
                )
                .withSockJS(); // <--- 에러가 계속나면 이걸 잠시 주석처리 해보세요.
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }
}
