// package com.project.domain.robot.entity;

// import java.time.LocalDateTime;

// import jakarta.persistence.Column;
// import jakarta.persistence.Entity;
// import jakarta.persistence.EnumType;
// import jakarta.persistence.Enumerated;
// import jakarta.persistence.GeneratedValue;
// import jakarta.persistence.GenerationType;
// import jakarta.persistence.Id;
// import lombok.AccessLevel;
// import lombok.Getter;
// import lombok.NoArgsConstructor;

// @Entity
// @Getter
// @NoArgsConstructor(access = AccessLevel.PROTECTED)
// public class RobotEventLog {
//     @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
//     private Long id;
//     private String carId;

//     //private String eventName;
//     @Enumerated(EnumType.STRING)
//     private Severity severity; // 이벤트 중요도

//     @Column(columnDefinition = "TEXT")
//     private String details; // 아마 JSON 문자열 형태일 듯

//     private LocalDateTime ts;
// }
// enum Severity {
//     DEBUG, INFO, WARN, ERROR, CRITICAL
// }