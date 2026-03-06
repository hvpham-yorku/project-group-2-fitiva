from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from api.models import WorkoutSession

User = get_user_model()


class ProgressSummaryDashboardTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="dashboarduser",
            password="UserPass123!",
            email="dashboard@example.com",
            is_trainer=False
        )
        self.other_user = User.objects.create_user(
            username="otheruser",
            password="UserPass123!",
            email="other@example.com",
            is_trainer=False
        )
        self.dashboard_url = "/api/dashboard/summary/"

    'Testing that dashboard shows correct totals for a user with workout history'
    def test_get_progress_summary_with_workout_data(self):
        self.client.force_authenticate(user=self.user)
        WorkoutSession.objects.create(
            user=self.user,
            title="Upper Body Workout",
            duration_minutes=45,
            completed=True,
            completed_at=timezone.now()
        )
        WorkoutSession.objects.create(
            user=self.user,
            title="Leg Day Workout",
            duration_minutes=30,
            completed=True,
            completed_at=timezone.now()
        )

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_workouts"], 2)
        self.assertEqual(response.data["total_time_trained"], 75)

    def test_get_progress_summary_with_no_workouts(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_workouts"], 0)
        self.assertEqual(response.data["total_time_trained"], 0)

    'Incomplete workouts are excluded from dashboard totals'
    def test_dashboard_only_counts_completed_workouts(self):
        self.client.force_authenticate(user=self.user)
        WorkoutSession.objects.create(
            user=self.user,
            title="Completed Workout",
            duration_minutes=40,
            completed=True,
            completed_at=timezone.now()
        )
        WorkoutSession.objects.create(
            user=self.user,
            title="Incomplete Workout",
            duration_minutes=20,
            completed=False
        )

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_workouts"], 1)
        self.assertEqual(response.data["total_time_trained"], 40)

    'Dashboard only shows the authenticated users progress'
    def test_dashboard_does_not_include_other_users_data(self):
        self.client.force_authenticate(user=self.user)
        WorkoutSession.objects.create(
            user=self.user,
            title="My Workout",
            duration_minutes=35,
            completed=True,
            completed_at=timezone.now()
        )
        WorkoutSession.objects.create(
            user=self.other_user,
            title="Other User Workout",
            duration_minutes=60,
            completed=True,
            completed_at=timezone.now()
        )

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_workouts"], 1)
        self.assertEqual(response.data["total_time_trained"], 35)

    'unauthenticated users cannot access the dashboard'
    def test_dashboard_requires_authentication(self):
        response = self.client.get(self.dashboard_url)

        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
        )
    'Dashboard returns visual/chart data for the frontend'
    def test_dashboard_visual_data_is_returned(self):
        self.client.force_authenticate(user=self.user)
        WorkoutSession.objects.create(
            user=self.user,
            title="Workout A",
            duration_minutes=25,
            completed=True,
            completed_at=timezone.now()
        )
        WorkoutSession.objects.create(
            user=self.user,
            title="Workout B",
            duration_minutes=50,
            completed=True,
            completed_at=timezone.now()
        )

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("chart_data", response.data)
        self.assertIsInstance(response.data["chart_data"], list)
        
    'Dashboard should return empty visual data when user has no workouts'
    def test_dashboard_visual_data_returns_empty_list_when_no_workouts(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("chart_data", response.data)
        self.assertEqual(response.data["chart_data"], [])

    'Dashboard correctly sums larger workout histories'
    def test_dashboard_handles_multiple_completed_workouts_correctly(self):
        self.client.force_authenticate(user=self.user)

        WorkoutSession.objects.create(
            user=self.user,
            title="Workout 1",
            duration_minutes=15,
            completed=True,
            completed_at=timezone.now()
        )
        WorkoutSession.objects.create(
            user=self.user,
            title="Workout 2",
            duration_minutes=20,
            completed=True,
            completed_at=timezone.now()
        )
        WorkoutSession.objects.create(
            user=self.user,
            title="Workout 3",
            duration_minutes=25,
            completed=True,
            completed_at=timezone.now()
        )
        WorkoutSession.objects.create(
            user=self.user,
            title="Workout 4",
            duration_minutes=40,
            completed=True,
            completed_at=timezone.now()
        )

        response = self.client.get(self.dashboard_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_workouts"], 4)
        self.assertEqual(response.data["total_time_trained"], 100)