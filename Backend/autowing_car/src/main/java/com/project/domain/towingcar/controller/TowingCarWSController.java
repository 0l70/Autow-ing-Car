package com.project.domain.towingcar.controller;

import java.security.Principal;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarConnectRequestDto;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarDisconnectRequestDto;
import com.project.domain.towingcar.dto.TowingCarWebSocketDtos.CarDispatchRequestDto;
import com.project.domain.towingcar.service.TowingCarService;

import io.github.springwolf.core.asyncapi.annotations.AsyncOperation;
import io.github.springwolf.core.asyncapi.annotations.AsyncPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 견인차 관리 WebSocket Controller
 * 
 * Client → Server 요청 처리 및 AsyncAPI 문서 자동 생성
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class TowingCarWSController {

    private final TowingCarService towingCarService;

    // ========== Client → Server (SEND) ==========

    @MessageMapping("/car/dispatch")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/car/dispatch", description = "항공편에 가용한 견인차를 자동으로 배차합니다. 시스템이 IDLE 상태의 차량 중 가장 가까운 차량을 선택하여 배차합니다."))
    public void dispatchCar(@Payload CarDispatchRequestDto requestDto, Principal principal) {
        log.info("[WS] Dispatch Request: Pilot={}, Flight={}", principal.getName(), requestDto.getFlightNumber());
        towingCarService.dispatchCarToFlight(requestDto.getFlightNumber());
    }

    @MessageMapping("/car/connect")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/car/connect", description = "기장이 항공기와 견인차를 연결합니다. 자동 또는 수동 모드에서 모두 사용 가능합니다."))
    public void connectCar(@Payload CarConnectRequestDto requestDto, Principal principal) {
        log.info("[WS] Connect Request: Pilot={}, Flight={}", principal.getName(), requestDto.getFlightId());
        towingCarService.connectCar(principal.getName(), requestDto);
    }

    @MessageMapping("/car/disconnect")
    @AsyncPublisher(operation = @AsyncOperation(channelName = "/app/car/disconnect", description = "항공기와 견인차의 연결을 해제합니다. 수동 모드에서만 사용 가능합니다."))
    public void disconnectCar(@Payload CarDisconnectRequestDto requestDto, Principal principal) {
        log.info("[WS] Disconnect Request: Pilot={}, Flight={}", principal.getName(), requestDto.getFlightId());
        towingCarService.disconnectCar(principal.getName(), requestDto);
    }

    // ========== Server → Client (SUBSCRIBE) - 문서화용 ==========

    // @AsyncListener(operation = @AsyncOperation(channelName =
    // "/topic/car/{carCode}", description = "특정 견인차의 실시간 상태를 브로드캐스트합니다. MQTT 모니터링
    // 데이터를 WebSocket으로 중계하여 위치, 배터리, 연결 상태 등을 전달합니다."))
    // public void subscribeCarStatus(@DestinationVariable String carCode) {
    // // 문서화만을 위한 메서드 - 실제 구현은 TowingCarWebSocketService에서 수행
    // }

    // @AsyncListener(operation = @AsyncOperation(channelName =
    // "/topic/flight/{scheduleId}", description = "특정 항공편 관련 이벤트를 브로드캐스트합니다. 배차 완료,
    // 연결 상태 변경 등의 이벤트를 실시간으로 전달합니다."))
    // public void subscribeFlightEvents(@DestinationVariable Long scheduleId) {
    // // 문서화용
    // }

    // @AsyncListener(operation = @AsyncOperation(channelName = "/user/queue/reply",
    // description = "사용자별 응답 메시지를 전송합니다. 요청에 대한 성공/실패 결과를 개별 사용자에게 전달합니다."))
    // public void subscribeUserReply() {
    // // 문서화용
    // }
}