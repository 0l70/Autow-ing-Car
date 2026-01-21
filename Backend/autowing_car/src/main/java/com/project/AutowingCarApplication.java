package com.project;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;


@SpringBootApplication(scanBasePackages = "com.project")
@EnableWebSocketMessageBroker
@EnableWebSocket
// @ComponentScan(basePackages = {"com.project", "com.project.infra.mqtt"})
public class AutowingCarApplication {

	public static void main(String[] args) {
		SpringApplication.run(AutowingCarApplication.class, args);
	}

}
