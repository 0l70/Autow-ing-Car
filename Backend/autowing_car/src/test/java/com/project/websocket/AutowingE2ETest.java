package com.project.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.project.domain.mission.dto.MissionWebSocketDtos.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.Transport;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;

import java.lang.reflect.Type;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class AutowingE2ETest {

    @LocalServerPort
    private int port;

    private WebSocketStompClient stompClient;

    @BeforeEach
    public void setup() {
        StandardWebSocketClient standardWebSocketClient = new StandardWebSocketClient();
        List<Transport> transports = Collections.singletonList(new WebSocketTransport(standardWebSocketClient));
        SockJsClient sockJsClient = new SockJsClient(transports);

        stompClient = new WebSocketStompClient(sockJsClient);
        
        // JSON 변환기 설정
        MappingJackson2MessageConverter messageConverter = new MappingJackson2MessageConverter();
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        messageConverter.setObjectMapper(objectMapper);
        stompClient.setMessageConverter(messageConverter);
    }

    @Test
    @DisplayName("[통합] 기장 요청 -> 관제사 수신 검증")
    public void verifyMissionRequestFlow() throws Exception {
        String url = "ws://localhost:" + port + "/ws-server";
        BlockingQueue<AdminAlertDto> blockingQueue = new LinkedBlockingQueue<>();

        // 1. 연결
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("login", "PilotUser");

        StompSession session = stompClient
                .connectAsync(url, new WebSocketHttpHeaders(), connectHeaders, new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);

        // 2. 관제사 구독
        session.subscribe("/topic/admin/requests", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return AdminAlertDto.class; // DTO 생성자 없으면 여기서 에러남
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                blockingQueue.offer((AdminAlertDto) payload);
            }
        });

        // 3. 요청 전송
        PilotRequestDto request = new PilotRequestDto("GATE_1", "RWY_A", null); // FlightId는 null로
        session.send("/app/mission/request", request);

        // 4. 검증
        AdminAlertDto result = blockingQueue.poll(5, TimeUnit.SECONDS);
        
        assertThat(result).isNotNull(); // DTO 수정 안하면 여기서 실패함
        assertThat(result.getDepartNode()).isEqualTo("GATE_1");
        System.out.println(">>> 테스트 성공: " + result);
    }
}