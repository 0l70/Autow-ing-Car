package com.project.infra.mqtt.config;

import java.util.UUID;

import com.project.infra.mqtt.MqttTopics;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import com.project.infra.mqtt.MqttTopics;
import com.project.infra.mqtt.handler.MqttInboundHandler;
import org.springframework.messaging.support.MessageBuilder;

import lombok.RequiredArgsConstructor;

@Configuration
@RequiredArgsConstructor
public class MqttInboundConfig {

    private final String clientId = "server-in-" + UUID.randomUUID();
    private final MqttPahoClientFactory mqttClientFactory;
    private final MqttInboundHandler mqttInboundHandler;

    // 1. 수신 채널 생성
    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    // 2. 어댑터 설정 (와일드카드 토픽 구독)
    @Bean
    public MessageProducer inboundAdapter() {
        
        MqttPahoMessageDrivenChannelAdapter adapter = new MqttPahoMessageDrivenChannelAdapter(
                clientId,
                mqttClientFactory,
                MqttTopics.SUB_MONITORING,
                MqttTopics.SUB_ACK
        );
        
        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInputChannel());
        return adapter;
    }

    // 3. 핸들러 연결
    @Bean
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public MessageHandler  inboundMessageHandler() {
        return message -> mqttInboundHandler.handleMessage(message);
    }
}
