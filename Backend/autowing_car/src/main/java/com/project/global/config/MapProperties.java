package com.project.global.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import java.util.ArrayList;
import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "app.map")
@Getter
@Setter
public class MapProperties {
    private List<String> locations = new ArrayList<>();
}
