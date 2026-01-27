package com.project.domain.user.service;

import org.springframework.stereotype.Service;

import com.project.domain.user.entity.User;
import com.project.domain.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    public User getUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public User getUserByEmployeeCode(String employeeCode) {
        return userRepository.findByEmployeeCode(employeeCode).orElse(null);
    }

    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean existsByEmployeeCode(String employeeCode) {
        return userRepository.existsByEmployeeCode(employeeCode);
    }
}
