package com.project.infra.websocket.config;

import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.security.Principal;

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
        registry.setUserDestinationPrefix("/user");
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
    }
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    // 클라이언트에서 보낸 { login: '...' } 헤더 읽기
                    String username = accessor.getFirstNativeHeader("login");
                    
                    if (username != null) {
                        // 강제로 Principal 생성하여 세션에 주입
                        accessor.setUser(new StompPrincipal(username));
                    }
                }
                return message;
            }
        });
    }

    class StompPrincipal implements Principal {
        private String name;

        public StompPrincipal(String name) { this.name = name; }
        
        @Override
        public String getName() { return name; }
    }
}
