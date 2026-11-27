import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/authentication/AuthProvider';
import { FullPageSpinner, RequireAuth, RequireWorkspace } from '@/features/authentication/guards';
import { ToastProvider } from '@/components/ui';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppShell } from '@/layouts/AppShell';
import { PwaUpdatePrompt } from '@/components/app/PwaPrompt';
import { ConfigMissing } from '@/pages/ConfigMissing';
import { isConfigured } from '@/lib/env';
import { PreferencesProvider } from '@/features/preferences/PreferencesProvider';
import { PrefsSync } from '@/features/preferences/PrefsSync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (n, e) => n < 2 && !/permission|not found|Not allowed/i.test(String((e as Error)?.message)), refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

const L = (f: () => Promise<Record<string, unknown>>, name: string) => lazy(() => f().then((m) => ({ default: m[name] as React.ComponentType })));

// Public
const Home = L(() => import('@/pages/public/Home'), 'Home');
const Catalog = L(() => import('@/pages/public/Catalog'), 'CatalogPage');
const CourseDetail = L(() => import('@/pages/public/CourseDetail'), 'CourseDetail');
const About = L(() => import('@/pages/public/Info'), 'About');
const ForSchools = L(() => import('@/pages/public/Info'), 'ForSchools');
const ForEducators = L(() => import('@/pages/public/Info'), 'ForEducators');
const Pricing = L(() => import('@/pages/public/Pricing'), 'Pricing');
const Contact = L(() => import('@/pages/public/Contact'), 'Contact');
const Privacy = L(() => import('@/pages/public/Legal'), 'Privacy');
const Terms = L(() => import('@/pages/public/Legal'), 'Terms');
const Accessibility = L(() => import('@/pages/public/Legal'), 'AccessibilityPage');
const Verify = L(() => import('@/pages/public/Verify'), 'Verify');
const NotFound = L(() => import('@/pages/public/NotFound'), 'NotFound');
// Auth
const Login = L(() => import('@/features/authentication/pages'), 'Login');
const Register = L(() => import('@/features/authentication/pages'), 'Register');
const Forgot = L(() => import('@/features/authentication/pages'), 'ForgotPassword');
const Reset = L(() => import('@/features/authentication/pages'), 'ResetPassword');
const Callback = L(() => import('@/features/authentication/pages'), 'AuthCallback');
const CheckEmail = L(() => import('@/features/authentication/pages'), 'CheckEmail');
const Onboarding = L(() => import('@/features/profiles/Onboarding'), 'Onboarding');
const Suspended = L(() => import('@/features/authentication/pages'), 'Suspended');
// Shared app
const DashboardRedirect = L(() => import('@/features/profiles/DashboardRedirect'), 'DashboardRedirect');
const Notifications = L(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage');
const Settings = L(() => import('@/features/profiles/Settings'), 'SettingsPage');
const SupportList = L(() => import('@/features/support/SupportPages'), 'SupportList');
const SupportTicket = L(() => import('@/features/support/SupportPages'), 'SupportTicketPage');
const SchoolApply = L(() => import('@/features/schools/SchoolApply'), 'SchoolApply');
const Invitations = L(() => import('@/features/schools/Invitations'), 'InvitationsPage');
const InstructorApply = L(() => import('@/features/teachers/InstructorApply'), 'InstructorApply');
const Discussions = L(() => import('@/features/classroom/Discussions'), 'DiscussionsPage');
const SpaceRoom = L(() => import('@/features/classroom/Discussions'), 'SpaceRoom');
// Learner
const LearnHome = L(() => import('@/features/learning/LearnerHome'), 'LearnerHome');
const MyLearning = L(() => import('@/features/learning/MyLearning'), 'MyLearning');
const Explore = L(() => import('@/features/learning/Explore'), 'Explore');
const CourseHome = L(() => import('@/features/learning/CourseHome'), 'CourseHome');
const LessonPlayer = L(() => import('@/features/learning/LessonPlayer'), 'LessonPlayer');
const LearnerClasses = L(() => import('@/features/classroom/LearnerClasses'), 'LearnerClasses');
const MyScoresPage = L(() => import('@/features/scores/ScoreSheets'), 'MyScoresPage');
const ClassRoom = L(() => import('@/features/classroom/ClassRoom'), 'ClassRoomPage');
const LiveSession = L(() => import('@/features/live/LiveSessionPage'), 'LiveSessionPage');
const LearnerAssessments = L(() => import('@/features/assessments/LearnerAssessments'), 'LearnerAssessments');
const AssessmentStart = L(() => import('@/features/assessments/LearnerAssessments'), 'AssessmentStart');
const AttemptPage = L(() => import('@/features/assessments/AttemptPage'), 'AttemptPage');
const LearnerAssignments = L(() => import('@/features/assignments/LearnerAssignments'), 'LearnerAssignments');
const AssignmentSubmit = L(() => import('@/features/assignments/LearnerAssignments'), 'AssignmentSubmitPage');
const Resources = L(() => import('@/features/learning/Resources'), 'ResourcesPage');
const Progress = L(() => import('@/features/analytics/LearnerProgress'), 'LearnerProgress');
const Certificates = L(() => import('@/features/certificates/CertificatesPage'), 'CertificatesPage');
const CertificateView = L(() => import('@/features/certificates/CertificatesPage'), 'CertificateView');
// Teacher
const TeachHome = L(() => import('@/features/teachers/TeacherHome'), 'TeacherHome');
const TeachCourses = L(() => import('@/features/courses/TeacherCourses'), 'TeacherCourses');
const CourseNew = L(() => import('@/features/courses/CourseForm'), 'CourseNewPage');
const CourseEditor = L(() => import('@/features/courses/CourseEditor'), 'CourseEditor');
const LessonEditor = L(() => import('@/features/lessons/LessonEditor'), 'LessonEditor');
const TeachLessons = L(() => import('@/features/lessons/TeacherLessons'), 'TeacherLessons');
const TeachClasses = L(() => import('@/features/classroom/TeacherClasses'), 'TeacherClasses');
const TeachClass = L(() => import('@/features/classroom/TeacherClass'), 'TeacherClassPage');
const TeachAssessments = L(() => import('@/features/assessments/TeacherAssessments'), 'TeacherAssessments');
const AssessmentBuilder = L(() => import('@/features/assessments/AssessmentBuilder'), 'AssessmentBuilder');
const Banks = L(() => import('@/features/assessments/QuestionBanks'), 'QuestionBanks');
const BankEditor = L(() => import('@/features/assessments/QuestionBanks'), 'BankEditor');
const GradeAttempt = L(() => import('@/features/assessments/AttemptPage'), 'GradeAttemptPage');
const TeachAssignments = L(() => import('@/features/assignments/TeacherAssignments'), 'TeacherAssignments');
const AssignmentManage = L(() => import('@/features/assignments/TeacherAssignments'), 'AssignmentManagePage');
const TeachLive = L(() => import('@/features/live/TeacherLive'), 'TeacherLive');
const TeachStudents = L(() => import('@/features/teachers/TeacherStudents'), 'TeacherStudents');
const TeachResources = L(() => import('@/features/teachers/TeacherResources'), 'TeacherResources');
const TeachAnnouncements = L(() => import('@/features/notifications/Announcements'), 'TeacherAnnouncements');
const TeachReports = L(() => import('@/features/analytics/TeacherReports'), 'TeacherReports');
// School
const SchoolHome = L(() => import('@/features/schools/SchoolHome'), 'SchoolHome');
const SchoolStudents = L(() => import('@/features/schools/SchoolPeople'), 'SchoolStudents');
const SchoolTeachers = L(() => import('@/features/schools/SchoolPeople'), 'SchoolTeachers');
const SchoolClasses = L(() => import('@/features/schools/SchoolClasses'), 'SchoolClasses');
const SchoolClass = L(() => import('@/features/schools/SchoolClasses'), 'SchoolClassPage');
const SchoolAcademic = L(() => import('@/features/schools/SchoolAcademic'), 'SchoolAcademic');
const SchoolCourses = L(() => import('@/features/schools/SchoolCourses'), 'SchoolCourses');
const SchoolAttendance = L(() => import('@/features/schools/SchoolAttendance'), 'SchoolAttendance');
const SchoolAnnouncements = L(() => import('@/features/notifications/Announcements'), 'SchoolAnnouncements');
const SchoolReports = L(() => import('@/features/schools/SchoolReports'), 'SchoolReports');
const SchoolSettings = L(() => import('@/features/schools/SchoolSettings'), 'SchoolSettings');
// Admin
const AdminHome = L(() => import('@/features/administration/AdminHome'), 'AdminHome');
const AdminUsers = L(() => import('@/features/administration/AdminUsers'), 'AdminUsers');
const AdminSchools = L(() => import('@/features/administration/AdminSchools'), 'AdminSchools');
const AdminTeachers = L(() => import('@/features/administration/AdminTeachers'), 'AdminTeachers');
const AdminCourses = L(() => import('@/features/administration/AdminCourses'), 'AdminCourses');
const AdminCategories = L(() => import('@/features/administration/AdminCategories'), 'AdminCategories');
const AdminAssessments = L(() => import('@/features/administration/AdminOversight'), 'AdminAssessments');
const AdminCertificates = L(() => import('@/features/administration/AdminOversight'), 'AdminCertificates');
const AdminLive = L(() => import('@/features/administration/AdminOversight'), 'AdminLive');
const AdminSubs = L(() => import('@/features/subscriptions/AdminSubscriptions'), 'AdminSubscriptions');
const AdminAnnouncements = L(() => import('@/features/notifications/Announcements'), 'AdminAnnouncements');
const AdminSupport = L(() => import('@/features/support/SupportPages'), 'AdminSupport');
const AdminInbox = L(() => import('@/features/administration/AdminInbox'), 'AdminInbox');
const AdminAudit = L(() => import('@/features/administration/AdminAudit'), 'AdminAudit');
const AdminMonitor = L(() => import('@/features/administration/AdminMonitor'), 'AdminMonitor');
const AdminSettings = L(() => import('@/features/administration/AdminSettings'), 'AdminSettings');

// Round 2
const JoinClass = L(() => import('@/features/classroom/JoinClass'), 'JoinClassPage');
const CalendarPage = L(() => import('@/features/calendar/CalendarPage'), 'CalendarPage');
const MyGrades = L(() => import('@/features/analytics/MyGrades'), 'MyGrades');
const Gradebook = L(() => import('@/features/analytics/Gradebook'), 'GradebookPage');
const ConnectHub = L(() => import('@/features/connect/ConnectHub'), 'ConnectHub');
const GroupRoom = L(() => import('@/features/connect/GroupRoom'), 'GroupRoom');
const AiCompanion = L(() => import('@/features/intelligence/AiCompanion'), 'AiCompanion');
const Studio = L(() => import('@/features/intelligence/ResourceStudio'), 'ResourceStudio');
const StudioDoc = L(() => import('@/features/intelligence/ResourceStudio'), 'StudioDocument');
const PulsePage = L(() => import('@/features/intelligence/ClassPulse'), 'ClassPulsePage');
const ArenaHome = L(() => import('@/features/arena/ArenaHome'), 'ArenaHome');
const ArenaPlay = L(() => import('@/features/arena/ArenaPlay'), 'ArenaPlay');
const CurriculumLibrary = L(() => import('@/features/curriculum/CurriculumLibrary'), 'CurriculumLibrary');
const ChallengeStudio = L(() => import('@/features/arena/ChallengeStudio'), 'ChallengeStudio');
const LabHome = L(() => import('@/features/lab/LabHome'), 'LabHome');
const CodeLab = L(() => import('@/features/lab/code/CodeLab'), 'CodeLabPage');
const SharedProject = L(() => import('@/features/lab/code/CodeLab'), 'SharedProjectPage');
const ScienceLab = L(() => import('@/features/lab/science/ScienceLab'), 'ScienceLab');
const MathLab = L(() => import('@/features/lab/math/MathLab'), 'MathLab');
const AdminCurriculum = L(() => import('@/features/administration/AdminCurriculum'), 'AdminCurriculum');
const AdminArena = L(() => import('@/features/administration/AdminArena'), 'AdminArena');
const AdminIntegrations = L(() => import('@/features/administration/AdminIntegrations'), 'AdminIntegrations');
const OAuthDone = L(() => import('@/features/live/OAuthDone'), 'OAuthDone');

const S = ({ children }: { children: ReactNode }) => <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>;

export function App() {
  if (!isConfigured) return <ConfigMissing />;
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <PrefsSync />
            <S>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route index element={<Home />} />
                  <Route path="courses" element={<Catalog />} />
                  <Route path="courses/:slug" element={<CourseDetail />} />
                  <Route path="about" element={<About />} />
                  <Route path="for-schools" element={<ForSchools />} />
                  <Route path="for-educators" element={<ForEducators />} />
                  <Route path="pricing" element={<Pricing />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="privacy" element={<Privacy />} />
                  <Route path="terms" element={<Terms />} />
                  <Route path="accessibility" element={<Accessibility />} />
                  <Route path="verify" element={<Verify />} />
                  <Route path="verify/:serial" element={<Verify />} />
                  <Route path="suspended" element={<Suspended />} />
                  <Route path="join" element={<JoinClass />} />
                  <Route path="join/:code" element={<JoinClass />} />
                  <Route path="lab/share/:slug" element={<SharedProject />} />
                </Route>
                <Route element={<AuthLayout />}>
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="check-email" element={<CheckEmail />} />
                  <Route path="forgot-password" element={<Forgot />} />
                  <Route path="reset-password" element={<Reset />} />
                  <Route path="auth/callback" element={<Callback />} />
                </Route>
                <Route path="onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
                <Route path="certificates/:serial/print" element={<RequireAuth><CertificateView /></RequireAuth>} />

                <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                  <Route path="dashboard" element={<DashboardRedirect />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="support" element={<SupportList />} />
                  <Route path="support/:ticketId" element={<SupportTicket />} />
                  <Route path="schools/apply" element={<SchoolApply />} />
                  <Route path="invitations" element={<Invitations />} />
                  <Route path="teach/apply" element={<InstructorApply />} />
                  <Route path="discussions" element={<Discussions />} />
                  <Route path="discussions/:spaceId" element={<SpaceRoom />} />
                  <Route path="curriculum" element={<CurriculumLibrary />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="connect" element={<ConnectHub />} />
                  <Route path="connect/groups/:groupId" element={<GroupRoom />} />
                  <Route path="ai" element={<AiCompanion />} />
                  <Route path="arena" element={<ArenaHome />} />
                  <Route path="arena/play/:slug" element={<ArenaPlay />} />
                  <Route path="lab" element={<LabHome />} />
                  <Route path="lab/code" element={<CodeLab />} />
                  <Route path="lab/code/:projectId" element={<CodeLab />} />
                  <Route path="lab/science" element={<ScienceLab />} />
                  <Route path="lab/science/:tool" element={<ScienceLab />} />
                  <Route path="lab/math" element={<MathLab />} />
                  <Route path="lab/math/:tool" element={<MathLab />} />
                  <Route path="integrations/:provider/done" element={<OAuthDone />} />
                  <Route path="studio" element={<RequireWorkspace kind="teacher"><Studio /></RequireWorkspace>} />
                  <Route path="studio/:docId" element={<RequireWorkspace kind="teacher"><StudioDoc /></RequireWorkspace>} />

                  <Route path="learn">
                    <Route index element={<LearnHome />} />
                    <Route path="courses" element={<MyLearning />} />
                    <Route path="explore" element={<Explore />} />
                    <Route path="courses/:courseId" element={<CourseHome />} />
                    <Route path="courses/:courseId/lessons/:lessonId" element={<LessonPlayer />} />
                    <Route path="classes" element={<LearnerClasses />} />
                    <Route path="scores" element={<MyScoresPage />} />
                    <Route path="classes/:classId" element={<ClassRoom />} />
                    <Route path="live/:sessionId" element={<LiveSession />} />
                    <Route path="assessments" element={<LearnerAssessments />} />
                    <Route path="assessments/:assessmentId" element={<AssessmentStart />} />
                    <Route path="assessments/attempt/:attemptId" element={<AttemptPage />} />
                    <Route path="assignments" element={<LearnerAssignments />} />
                    <Route path="assignments/:assignmentId" element={<AssignmentSubmit />} />
                    <Route path="resources" element={<Resources />} />
                    <Route path="progress" element={<Progress />} />
                    <Route path="certificates" element={<Certificates />} />
                    <Route path="grades" element={<MyGrades />} />
                  </Route>

                  <Route path="teach" element={<RequireWorkspace kind="teacher"><OutletPassthrough /></RequireWorkspace>}>
                    <Route index element={<TeachHome />} />
                    <Route path="courses" element={<TeachCourses />} />
                    <Route path="courses/new" element={<CourseNew />} />
                    <Route path="courses/:courseId" element={<CourseEditor />} />
                    <Route path="courses/:courseId/lessons/:lessonId" element={<LessonEditor />} />
                    <Route path="lessons" element={<TeachLessons />} />
                    <Route path="classes" element={<TeachClasses />} />
                    <Route path="classes/:classId" element={<TeachClass />} />
                    <Route path="assessments" element={<TeachAssessments />} />
                    <Route path="assessments/:assessmentId" element={<AssessmentBuilder />} />
                    <Route path="attempts/:attemptId" element={<GradeAttempt />} />
                    <Route path="banks" element={<Banks />} />
                    <Route path="banks/:bankId" element={<BankEditor />} />
                    <Route path="assignments" element={<TeachAssignments />} />
                    <Route path="assignments/:assignmentId" element={<AssignmentManage />} />
                    <Route path="live" element={<TeachLive />} />
                    <Route path="students" element={<TeachStudents />} />
                    <Route path="resources" element={<TeachResources />} />
                    <Route path="announcements" element={<TeachAnnouncements />} />
                    <Route path="reports" element={<TeachReports />} />
                    <Route path="gradebook" element={<Gradebook />} />
                    <Route path="challenges" element={<ChallengeStudio />} />
                    <Route path="pulse" element={<PulsePage />} />
                  </Route>

                  <Route path="school/:schoolId" element={<RequireWorkspace kind="school"><OutletPassthrough /></RequireWorkspace>}>
                    <Route index element={<SchoolHome />} />
                    <Route path="students" element={<SchoolStudents />} />
                    <Route path="teachers" element={<SchoolTeachers />} />
                    <Route path="classes" element={<SchoolClasses />} />
                    <Route path="classes/:classId" element={<SchoolClass />} />
                    <Route path="academic" element={<SchoolAcademic />} />
                    <Route path="courses" element={<SchoolCourses />} />
                    <Route path="attendance" element={<SchoolAttendance />} />
                    <Route path="announcements" element={<SchoolAnnouncements />} />
                    <Route path="reports" element={<SchoolReports />} />
                    <Route path="settings" element={<SchoolSettings />} />
                  </Route>

                  <Route path="admin" element={<RequireWorkspace kind="admin"><OutletPassthrough /></RequireWorkspace>}>
                    <Route index element={<AdminHome />} />
                    <Route path="monitor" element={<AdminMonitor />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="schools" element={<AdminSchools />} />
                    <Route path="teachers" element={<AdminTeachers />} />
                    <Route path="courses" element={<AdminCourses />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="assessments" element={<AdminAssessments />} />
                    <Route path="certificates" element={<AdminCertificates />} />
                    <Route path="live" element={<AdminLive />} />
                    <Route path="subscriptions" element={<AdminSubs />} />
                    <Route path="announcements" element={<AdminAnnouncements />} />
                    <Route path="support" element={<AdminSupport />} />
                    <Route path="inbox" element={<AdminInbox />} />
                    <Route path="audit" element={<AdminAudit />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="curriculum" element={<AdminCurriculum />} />
                    <Route path="arena" element={<AdminArena />} />
                    <Route path="integrations" element={<AdminIntegrations />} />
                  </Route>
                </Route>
                <Route path="home" element={<Navigate to="/" replace />} />
                <Route element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
              </Routes>
            </S>
            <PwaUpdatePrompt />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}

function OutletPassthrough() {
  return <Outlet />;
}
