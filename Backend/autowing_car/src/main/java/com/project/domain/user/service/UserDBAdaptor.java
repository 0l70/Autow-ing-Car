package com.project.domain.user.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.project.domain.common.UserRole;
import com.project.domain.user.entity.User;
import com.project.domain.user.repository.UserRepository;
import com.project.global.error.domain.user.UserException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserDBAdaptor {
    private final UserRepository userRepository;

    public User findUserById(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new UserException("User not found: " + id));
    }

    public User findUserByEmail(String email) {
        return userRepository.findByEmail(email).orElseThrow(() -> new UserException("User not found: " + email));
    }

    public User findUserByEmployeeCode(String employeeCode) {
        return userRepository.findByEmployeeCode(employeeCode)
                .orElseThrow(() -> new UserException("User not found: " + employeeCode));
    }

    public User findUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UserException("User not found: " + username));
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
