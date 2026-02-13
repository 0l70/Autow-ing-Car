package com.project.global.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class TimescaleDBInitializer {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    public CommandLineRunner initTimescaleDB() {
        return args -> {
            try {
                // 1. Check if extension exists
                // Note: User must have installed timescaledb extension in Postgres.
                // We assume the Docker image 'timescale/timescaledb-ha:pg16' has it enabled.

                // 2. Convert driving_log to hypertable
                // time_column: created_at
                // chunk_time_interval: 1 day (default is 7 days, but for logs 1 day might be
                // better depending on volume)

                String sql = "SELECT create_hypertable('driving_log', 'created_at', if_not_exists => TRUE);";

                jdbcTemplate.execute(sql);
                log.info("✅ [TimescaleDB] Verified 'driving_log' is a hypertable.");

            } catch (Exception e) {
                // If it fails, it might be because it's already a hypertable or permission
                // issues.
                // Since 'if_not_exists => TRUE' is used, simple existence shouldn't throw.
                // But if the table is not empty and has primary key constraints that conflict
                // with default hypertable partitioning, it might fail.
                log.warn("⚠️ [TimescaleDB] Hypertable initialization warning: {}", e.getMessage());
            }
        };
    }
}
