package com.project.infra.mqtt;

import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.IntegrationComponentScan;
import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.handler.annotation.Header;


@Configuration
@IntegrationComponentScan // Gateway 인터페이스 스캔을 위해 필수
public class MqttConfig {

    @Value("${spring.mqtt.broker.url}")
    private String brokerUrl;

    @Value("${spring.mqtt.client.id}")
    private String clientId;

    @Value("${spring.mqtt.topic}")
    private String defaultTopic;

    // 1. 연결 옵션 설정
    @Bean
    public MqttConnectOptions mqttConnectOptions() {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setServerURIs(new String[]{brokerUrl});
        options.setCleanSession(true);
        options.setAutomaticReconnect(true); // 자동 재연결 기능 추가
        options.setConnectionTimeout(10);
        return options;
    }

    // 2. 클라이언트 팩토리 (Spring Integration이 사용하는 핵심 공장)
    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        factory.setConnectionOptions(mqttConnectOptions());
        return factory;
    }

    // --- [송신/Outbound] ---

    // --- Publisher (전송) 설정 ---

    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutbound() {
        MqttPahoMessageHandler messageHandler = new MqttPahoMessageHandler(clientId + "-pub", mqttClientFactory());
        messageHandler.setAsync(true);
        messageHandler.setDefaultTopic(defaultTopic);
        return messageHandler;
    }

    @Bean
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    // 전송을 쉽게 하기 위한 인터페이스 (Messaging Gateway)
    @MessagingGateway(defaultRequestChannel = "mqttOutboundChannel")
    public interface MqttGateway {
        void sendToMqtt(String data);
        void sendToMqtt(String data, @Header(MqttHeaders.TOPIC) String topic);
    }

    // --- Subscriber (수신) 설정 ---

    @Bean
    public MessageProducer inbound() {
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(clientId + "-sub", mqttClientFactory(), defaultTopic);
        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInboundChannel());
        return adapter;
    }

    @Bean
    public MessageChannel mqttInboundChannel() {
        return new DirectChannel();
    }

    // 수신한 메시지를 처리하는 핸들러
    @Bean
    @ServiceActivator(inputChannel = "mqttInboundChannel")
    public MessageHandler handler() {
        return message -> {
            System.out.println("------------------------------------");
            System.out.println("수신된 토픽: " + message.getHeaders().get(MqttHeaders.RECEIVED_TOPIC));
            System.out.println("수신된 내용: " + message.getPayload());
            System.out.println("------------------------------------");
        };
    }
}