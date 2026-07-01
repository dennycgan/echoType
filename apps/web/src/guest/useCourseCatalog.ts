import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CourseDTO,
  CourseListSort,
  CourseMode,
  CategoryDTO,
  CreateCourseInput,
  UpdateCourseInput,
} from '@echotype/shared';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthProvider';
import {
  checkGuestTitleAvailable,
  createGuestCourse,
  deleteGuestCourse,
  getGuestCategory,
  getGuestCourse,
  listGuestCategories,
  listGuestCourses,
  updateGuestCourse,
} from './guestCoursesStore';

type ListOpts = { q?: string; sort?: CourseListSort; categoryId?: string | 'null' };

export function useIsGuest() {
  const { status } = useAuth();
  return status === 'guest';
}

function useAuthReady() {
  const { status } = useAuth();
  return status !== 'loading';
}

export function useCourseList(courseMode: CourseMode, opts: ListOpts, enabled = true) {
  const { status } = useAuth();
  const isGuest = status === 'guest';
  const authReady = status !== 'loading';
  return useQuery({
    queryKey: isGuest
      ? ['guest-courses', courseMode, opts.categoryId, opts.q, opts.sort]
      : ['courses', courseMode, opts.categoryId ?? 'all', opts.q, opts.sort],
    queryFn: () =>
      isGuest
        ? listGuestCourses(courseMode, opts)
        : api.listCourses(
            courseMode,
            opts.categoryId !== undefined
              ? { q: opts.q, sort: opts.sort, categoryId: opts.categoryId }
              : { q: opts.q, sort: opts.sort },
          ),
    enabled: enabled && authReady,
  });
}

export function useCategoryList(courseMode: CourseMode, opts: { q?: string; sort?: CourseListSort }) {
  const { status } = useAuth();
  const isGuest = status === 'guest';
  const authReady = status !== 'loading';
  return useQuery({
    queryKey: isGuest
      ? ['guest-categories', courseMode, opts.q, opts.sort]
      : ['categories', courseMode, opts.q, opts.sort],
    queryFn: () =>
      isGuest ? listGuestCategories(courseMode, opts) : api.listCategories(courseMode, opts),
    enabled: authReady,
  });
}

export function useCourseById(id: string | undefined) {
  const { status } = useAuth();
  const isGuest = status === 'guest';
  const authReady = status !== 'loading';
  return useQuery({
    queryKey: isGuest ? ['guest-course', id] : ['course', id],
    queryFn: () => {
      if (!id) throw new Error('missing id');
      if (isGuest) {
        const course = getGuestCourse(id);
        if (!course) throw Object.assign(new Error('not_found'), { status: 404 });
        return course;
      }
      return api.getCourse(id);
    },
    enabled: !!id && authReady,
  });
}

export function useCategoryById(id: string | undefined) {
  const { status } = useAuth();
  const isGuest = status === 'guest';
  const authReady = status !== 'loading';
  return useQuery({
    queryKey: isGuest ? ['guest-category', id] : ['category', id],
    queryFn: () => {
      if (!id) throw new Error('missing id');
      if (isGuest) {
        const cat = getGuestCategory(id);
        if (!cat) throw Object.assign(new Error('not_found'), { status: 404 });
        return cat;
      }
      return api.getCategory(id);
    },
    enabled: !!id && authReady,
  });
}

export function useSaveCourse() {
  const isGuest = useIsGuest();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      mode: 'create' | 'edit';
      payload: CreateCourseInput;
      courseId?: string;
    }): Promise<CourseDTO> => {
      if (isGuest) {
        if (args.mode === 'create') return createGuestCourse(args.payload);
        return updateGuestCourse(args.courseId!, args.payload);
      }
      if (args.mode === 'create') return api.createCourse(args.payload);
      return api.updateCourse(args.courseId!, args.payload);
    },
    onSuccess: () => {
      if (isGuest) {
        void qc.invalidateQueries({ queryKey: ['guest-courses'] });
        void qc.invalidateQueries({ queryKey: ['guest-categories'] });
        void qc.invalidateQueries({ queryKey: ['guest-course'] });
      } else {
        void qc.invalidateQueries({ queryKey: ['courses'] });
        void qc.invalidateQueries({ queryKey: ['categories'] });
      }
    },
  });
}

export function useDeleteCourse() {
  const isGuest = useIsGuest();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => {
      if (isGuest) {
        deleteGuestCourse(courseId);
        return Promise.resolve();
      }
      return api.deleteCourse(courseId);
    },
    onSuccess: (_data, courseId) => {
      if (isGuest) {
        qc.removeQueries({ queryKey: ['guest-course', courseId] });
        void qc.invalidateQueries({ queryKey: ['guest-courses'] });
      } else {
        qc.removeQueries({ queryKey: ['course', courseId] });
        void qc.invalidateQueries({ queryKey: ['courses'] });
        void qc.invalidateQueries({ queryKey: ['categories'] });
      }
    },
  });
}

export function useCheckTitleAvailable() {
  const isGuest = useIsGuest();
  return async (mode: CourseMode, title: string, excludeId?: string) => {
    if (isGuest) {
      return { available: checkGuestTitleAvailable(mode, title, excludeId) };
    }
    return api.checkCourseTitleAvailable(mode, title, excludeId);
  };
}

export function invalidateCourseQueries(qc: ReturnType<typeof useQueryClient>, isGuest: boolean) {
  if (isGuest) {
    void qc.invalidateQueries({ queryKey: ['guest-courses'] });
    void qc.invalidateQueries({ queryKey: ['guest-categories'] });
  } else {
    void qc.invalidateQueries({ queryKey: ['courses'] });
    void qc.invalidateQueries({ queryKey: ['categories'] });
  }
}
