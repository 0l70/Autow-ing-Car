package com.project.global.config;

import java.sql.SQLException;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class H2ServerConfig {
    @Bean(initMethod = "start", destroyMethod = "stop")
    public org.h2.tools.Server h2TcpServer() throws SQLException {
        return org.h2.tools.Server.createTcpServer("-tcp", "-tcpAllowOthers", "-tcpPort", "9092");
    }
}
