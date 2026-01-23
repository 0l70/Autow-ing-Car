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
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

import com.project.global.auth.AuthHandshakeInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final AuthHandshakeInterceptor authHandshakeInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-server")
                .setAllowedOriginPatterns(
                        "http://localhost:3000",
                        "http://127.0.0.1:3000")
                .setHandshakeHandler(new PrincipalHandshakeHandler())
                .addInterceptors(authHandshakeInterceptor) // 👈 Interceptor 추가
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setUserDestinationPrefix("/user");
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
    }

    // ----------------------------------------------------------------
    // [Inner Class] 세션 정보를 바탕으로 Principal 생성
    // ----------------------------------------------------------------
    private static class PrincipalHandshakeHandler extends DefaultHandshakeHandler {
        @Override
        protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler, 
                                          Map<String, Object> attributes) {
            // Interceptor에서 저장한 USER_ID를 가져와서 Principal로 만듦
            String userId = (String) attributes.get("USER_ID");
            
            if (userId == null) {
                return null;
            }
            return new StompPrincipal(userId);
        }
    }

    public static class StompPrincipal implements Principal {
        private final String name;
        public StompPrincipal(String name) { this.name = name; }
        @Override
        public String getName() { return name; }
    }

}
