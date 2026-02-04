package com.project.domain.map.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;

@Getter
@Builder
public class MapResponse {
    private String mapId;
    private List<NodeDto> nodes;
    private List<EdgeDto> edges;

    @Getter
    @Builder
    public static class NodeDto {
        private String id;
        private Double x;
        private Double y;
        private String status;
    }

    @Getter
    @Builder
    public static class EdgeDto {
        private String id;
        private String from;
        private String to;
        private Double cost;
        private List<PointDto> waypoints;
    }

    @Getter
    @Builder
    public static class PointDto {
        private Double x;
        private Double y;
    }
}
