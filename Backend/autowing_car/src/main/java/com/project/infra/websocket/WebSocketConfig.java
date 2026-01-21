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
        registry.addEndpoint("/ws-stomp")
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

/*
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 서버에서 클라이언트로 브로드캐스팅할 때 사용하는 prefix
        config.enableSimpleBroker("/topic");
        // 클라이언트에서 서버로 메시지를 보낼 때 사용하는 prefix (필요 시)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // WebSocket 연결 엔드포인트
        registry.addEndpoint("/ws-stomp").setAllowedOriginPatterns("*").withSockJS();
    }
}
*/