package com.project.infra.websocket.constant;

public class WebSocketTopics {

    // Mission & Controller
    public static final String TOPIC_CONTROLLER_REQUESTS = "/topic/controller/requests";
    public static final String QUEUE_REPLY = "/queue/reply";
    public static final String TOPIC_MISSION_UPDATES = "/topic/mission/updates";
    public static final String QUEUE_ERRORS = "/queue/errors";

    // Towing Car
    public static final String TOPIC_TOWING_CAR_PREFIX = "/topic/towingcar/";

    // Flight
    public static final String TOPIC_FLIGHT_PREFIX = "/topic/flight/";

    // Map
    public static final String TOPIC_MAP_INFO = "/topic/sys/map/info";

    // WebRTC
    public static final String TOPIC_VIDEO_OFFER_PREFIX = "/topic/video/offer/";
    public static final String TOPIC_VIDEO_ANSWER_PREFIX = "/topic/video/answer/";
    public static final String TOPIC_VIDEO_ICE_PREFIX = "/topic/video/ice/";

    public static String carChannel(String carCode) {
        return TOPIC_TOWING_CAR_PREFIX + carCode;
    }

    public static String flightChannel(Long scheduleId) {
        return TOPIC_FLIGHT_PREFIX + scheduleId;
    }

    public static String videoOffer(String receiverId) {
        return TOPIC_VIDEO_OFFER_PREFIX + receiverId;
    }

    public static String videoAnswer(String receiverId) {
        return TOPIC_VIDEO_ANSWER_PREFIX + receiverId;
    }

    public static String videoIce(String receiverId) {
        return TOPIC_VIDEO_ICE_PREFIX + receiverId;
    }
}
