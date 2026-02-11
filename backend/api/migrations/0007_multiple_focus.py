from django.db import migrations, models


def convert_string_to_array_safe(apps, schema_editor):
    """Safely convert existing single focus values to arrays"""
    UserProfile = apps.get_model('api', 'UserProfile')
    WorkoutPlan = apps.get_model('api', 'WorkoutPlan')
    
    # Convert UserProfile fitness_focus
    for profile in UserProfile.objects.all():
        try:
            old_value = profile.fitness_focus
            # Check if it's already a list (from previous attempts)
            if isinstance(old_value, list):
                continue
            # If it's a string, convert to list
            if isinstance(old_value, str):
                if old_value == 'mixed':
                    profile.fitness_focus = ['strength', 'cardio', 'flexibility']
                elif old_value:
                    profile.fitness_focus = [old_value]
                else:
                    profile.fitness_focus = ['strength']  # Default
                profile.save()
        except Exception as e:
            # If any error, set default
            profile.fitness_focus = ['strength']
            profile.save()
    
    # Convert WorkoutPlan focus
    for plan in WorkoutPlan.objects.all():
        try:
            old_value = plan.focus
            # Check if it's already a list
            if isinstance(old_value, list):
                continue
            # If it's a string, convert to list
            if isinstance(old_value, str):
                if old_value:
                    plan.focus = [old_value]
                else:
                    plan.focus = ['strength']  # Default
                plan.save()
        except Exception as e:
            # If any error, set default
            plan.focus = ['strength']
            plan.save()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_remove_workoutplan_is_subscription_and_more'),  # Update this to your actual last migration
    ]

    operations = [
        # First, make the field nullable temporarily
        migrations.AlterField(
            model_name='userprofile',
            name='fitness_focus',
            field=models.CharField(max_length=50, null=True, blank=True),
        ),
        migrations.AlterField(
            model_name='workoutplan',
            name='focus',
            field=models.CharField(max_length=50, null=True, blank=True),
        ),
        
        # Now change to JSONField
        migrations.AlterField(
            model_name='userprofile',
            name='fitness_focus',
            field=models.JSONField(
                default=list,
                help_text="List of fitness focuses (e.g., ['strength', 'cardio'])"
            ),
        ),
        migrations.AlterField(
            model_name='workoutplan',
            name='focus',
            field=models.JSONField(
                default=list,
                help_text="List of workout focuses (e.g., ['strength', 'cardio'])"
            ),
        ),
        
        # Finally, convert existing data
        migrations.RunPython(
            convert_string_to_array_safe,
            migrations.RunPython.noop
        ),
    ]
