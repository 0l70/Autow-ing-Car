package com.project.domain.webrtc.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalingMessage {
    private String type; // "OFFER", "ANSWER", "ICE"
    private String sdp; // SDP content
    private String candidate; // ICE candidate
    private String sdpMid; // ICE sdpMid
    private Integer sdpMLineIndex; // ICE sdpMLineIndex

    private String senderId; // e.g., "car-001" or "admin"
    private String receiverId; // e.g., "admin" or "car-001"
}
