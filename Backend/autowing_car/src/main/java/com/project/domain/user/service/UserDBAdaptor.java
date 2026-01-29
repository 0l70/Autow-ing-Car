package com.project.domain.user.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.project.domain.common.UserRole;
import com.project.domain.user.entity.User;
import com.project.domain.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserDBAdaptor {
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

    public java.util.Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public java.util.Optional<User> findByUserId(Long userId) {
        return userRepository.findById(userId);
    }

    public java.util.Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean existsByEmployeeCode(String employeeCode) {
        return userRepository.existsByEmployeeCode(employeeCode);
    }

    public List<User> findAllByRole(UserRole role) {
        return userRepository.findAllByRole(role);
    }

    public User save(User user) {
        return userRepository.save(user);
    }

    public User update(User user) {
        return userRepository.save(user);
    }
}
