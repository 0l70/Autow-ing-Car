package com.project;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;


@SpringBootApplication(scanBasePackages = "com.project")
// @ComponentScan(basePackages = {"com.project", "com.project.infra.mqtt"})
public class AutowingCarApplication {

	public static void main(String[] args) {
		SpringApplication.run(AutowingCarApplication.class, args);
	}

}
