package com.project.global.util;

import java.util.ArrayList;
import java.util.List;

/**
 * 경로 좌표 유틸리티
 * RDP 알고리즘으로 좌표 단순화
 */
public class RdpSimplifier {

    public static class Point {
        public double x;
        public double y;

        public Point(double x, double y) {
            this.x = x;
            this.y = y;
        }
    }

    /**
     * RDP 알고리즘 실행 - 좌표를 단순화하여 핵심 포인트만 유지
     * 
     * @param points  원본 좌표 리스트
     * @param epsilon 허용 오차 거리 (값이 클수록 더 많이 단순화됨)
     * @return 단순화된 좌표 리스트
     */
    public static List<Point> simplify(List<Point> points, double epsilon) {
        if (points.size() < 3) {
            return new ArrayList<>(points);
        }

        int firstPoint = 0;
        int lastPoint = points.size() - 1;
        List<Integer> indexToKeep = new ArrayList<>();

        // 시작점과 끝점은 항상 포함
        indexToKeep.add(firstPoint);
        indexToKeep.add(lastPoint);

        simplifyRecursive(points, firstPoint, lastPoint, epsilon, indexToKeep);

        // 인덱스 순서대로 정렬하여 반환
        List<Point> result = new ArrayList<>();
        List<Integer> sortedIndices = indexToKeep.stream().sorted().toList();
        for (int index : sortedIndices) {
            result.add(points.get(index));
        }

        return result;
    }

    private static void simplifyRecursive(List<Point> points, int first, int last, double epsilon,
            List<Integer> indexToKeep) {
        double maxDistance = 0;
        int index = 0;

        for (int i = first + 1; i < last; i++) {
            double distance = perpendicularDistance(points.get(i), points.get(first), points.get(last));
            if (distance > maxDistance) {
                maxDistance = distance;
                index = i;
            }
        }

        if (maxDistance > epsilon) {
            indexToKeep.add(index);
            simplifyRecursive(points, first, index, epsilon, indexToKeep);
            simplifyRecursive(points, index, last, epsilon, indexToKeep);
        }
    }

    /**
     * 점에서 직선(시작점-끝점)까지의 수직 거리 계산
     */
    private static double perpendicularDistance(Point p, Point start, Point end) {
        double dx = end.x - start.x;
        double dy = end.y - start.y;

        // 직선의 길이가 0인 경우 (시작점과 끝점이 같음)
        if (dx == 0 && dy == 0) {
            return Math.sqrt(Math.pow(p.x - start.x, 2) + Math.pow(p.y - start.y, 2));
        }

        double area = Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x);
        double bottom = Math.sqrt(Math.pow(dy, 2) + Math.pow(dx, 2));

        return area / bottom;
    }
}
