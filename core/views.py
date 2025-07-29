from django.contrib.auth import views as auth_views
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import authenticate, login as auth_login
from django.http import HttpResponseRedirect
from django.urls import reverse
from .forms import CustomUserCreationForm, EmailAuthenticationForm, ProfileUpdateForm
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from .models import SearchPattern
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import connection
from .models import GridLayout
from django.contrib.auth.decorators import login_required

# Create your views here.

def register(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Registration successful! You can now log in.')
            return redirect('login')
        else:
            messages.error(request, 'Please correct the errors below.')
    else:
        form = CustomUserCreationForm()
    return render(request, 'register.html', {'form': form})

# Custom login view to handle 'Remember me' and email login
def custom_login(request):
    from django.contrib.auth.views import LoginView
    class CustomLoginView(LoginView):
        template_name = 'login.html'
        authentication_form = EmailAuthenticationForm
        def form_valid(self, form):
            remember = self.request.POST.get('remember')
            if not remember:
                self.request.session.set_expiry(0)
            return super().form_valid(form)
    return CustomLoginView.as_view()(request)

def get_user_menus(user):
    from .models import UserRole, RoleMenu, Menu
    role_ids = UserRole.objects.filter(user=user).values_list('role_id', flat=True)
    menu_qs = Menu.objects.filter(
        id__in=RoleMenu.objects.filter(role_id__in=role_ids).values_list('menu_id', flat=True)
    ).order_by('order')
    parents = [m for m in menu_qs if m.parent_id is None and m.url not in ['/', '/about/', '/contact/']]
    menu_tree = []
    for parent in parents:
        children = [c for c in menu_qs if c.parent_id == parent.id]
        menu_tree.append({'menu': parent, 'children': children})
    return menu_tree

@login_required
def profile(request):
    if request.method == 'POST':
        form = ProfileUpdateForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            user = form.save(commit=False)
            password = form.cleaned_data.get('password')
            if password:
                user.set_password(password)
            user.save()
            messages.success(request, 'Profile updated successfully!')
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'message': 'Profile updated successfully!'})
            return redirect('home')
        else:
            messages.error(request, 'Please correct the errors below.')
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'errors': form.errors})
    else:
        form = ProfileUpdateForm(instance=request.user)
    # Render the modal template for both AJAX and normal requests
    return render(request, 'profile_modal.html', {'form': form, 'user': request.user})

@login_required
def home(request):
    form = ProfileUpdateForm(instance=request.user)
    menu_tree = get_user_menus(request.user)
    return render(request, 'home.html', {'user': request.user, 'form': form, 'menu_tree': menu_tree})

@login_required
def about(request):
    form = ProfileUpdateForm(instance=request.user)
    menu_tree = get_user_menus(request.user)
    return render(request, 'about.html', {'user': request.user, 'form': form, 'menu_tree': menu_tree})

@login_required
def contact(request):
    form = ProfileUpdateForm(instance=request.user)
    menu_tree = get_user_menus(request.user)
    return render(request, 'contact.html', {'user': request.user, 'form': form, 'menu_tree': menu_tree})

@login_required
def dynamic_grid(request, form_name):
    # 1. Get form config
    form_cursor = connection.cursor()
    form_cursor.execute("SELECT * FROM forms WHERE tableview = %s", [form_name])
    form_row = form_cursor.fetchone()
    if not form_row:
        menu_tree = get_user_menus(request.user)
        return render(request, 'dynamic_grid.html', {'error': 'Form not found.', 'menu_tree': menu_tree})
    select_fields_raw = [f.strip() for f in form_row[2].split(',')]
    table_name = form_row[3]
    # 2. Get column config
    cursor = connection.cursor()
    cursor.execute("SELECT field_label, field_name FROM search_config WHERE table_name = %s", [table_name])
    columns_config = cursor.fetchall()  # list of (field_label, field_name)
    # Build select_fields and columns in the order of select_fields_raw, using field_name for SQL and field_label for header
    select_fields = []
    columns = []
    for field in select_fields_raw:
        if field.lower() == 'id':
            continue
        for label, name in columns_config:
            if name == field:
                select_fields.append(name)
                columns.append((label, name))
                break
    # Always keep ID in the SQL query for backend use
    sql_fields = [f.strip() for f in form_row[2].split(',')]
    
    # Handle job field - join with job table to get job name
    if 'job' in sql_fields:
        # Replace job field with job name from join
        select_fields_with_job = []
        for field in sql_fields:
            if field == 'job':
                select_fields_with_job.append('j.name as job')
            elif field == 'id':
                select_fields_with_job.append('t.id')
            else:
                select_fields_with_job.append(field)
        
        sql = f"SELECT {', '.join(select_fields_with_job)} FROM {table_name} t LEFT JOIN job j ON t.job = j.id"
    else:
        sql = f"SELECT {', '.join(sql_fields)} FROM {table_name}"
    
    cursor.execute(sql)
    raw_data = cursor.fetchall()
    # Build a list of dicts for each row, mapping field_name to value
    data = []
    for row in raw_data:
        # Handle the case where we have aliased fields (like j.name as job)
        row_dict = {}
        for i, field in enumerate(sql_fields):
            if field == 'job' and 'j.name as job' in sql:
                # The job field comes from the alias, so use the alias name
                row_dict[field] = row[i]
            else:
                row_dict[field] = row[i]
        data.append(row_dict)
    total_count = len(data)
    menu_tree = get_user_menus(request.user)
    return render(request, 'dynamic_grid.html', {
        'columns': columns,  # list of (label, field_name) to display
        'data': data,        # list of dicts, field_name -> value
        'form_name': form_name,
        'table_name': table_name,
        'menu_tree': menu_tree,
        'total_count': total_count,
    })

@require_GET
@login_required
def api_fields(request, table_name):
    """Return search_config for a table as JSON."""
    cursor = connection.cursor()
    cursor.execute("SELECT field_label, field_name, field_type, operator_tags, lookup_sql, mandatory FROM search_config WHERE table_name = %s ORDER BY id", [table_name])
    fields = [
        {
            'label': row[0],
            'name': row[1],
            'type': row[2],
            'operator_tags': row[3],
            'lookup_sql': row[4],
            'mandatory': row[5],
        }
        for row in cursor.fetchall()
    ]
    return JsonResponse({'fields': fields})

@require_GET
@login_required
def api_options(request, table_name, field_name):
    """Return dropdown options for a field as JSON, using lookup_sql from search_config."""
    cursor = connection.cursor()
    cursor.execute("SELECT lookup_sql FROM search_config WHERE table_name = %s AND field_name = %s", [table_name, field_name])
    row = cursor.fetchone()
    if not row or not row[0]:
        return JsonResponse({'options': []})
    lookup_sql = row[0]
    cursor.execute(lookup_sql)
    options = [{'id': r[0], 'text': r[1]} for r in cursor.fetchall()]
    return JsonResponse({'options': options})

@require_POST
@csrf_exempt  # We'll handle CSRF in JS later
@login_required
def api_create(request, table_name):
    """Create a new record in table_name. For inputable dropdowns like job, check if the job exists and create it if needed."""
    data = json.loads(request.body)
    cursor = connection.cursor()
    
    try:
        # Start transaction
        cursor.execute("START TRANSACTION")
        
        # Handle job field specifically - create new job if it doesn't exist
        if 'job' in data and data['job']:
            job_name = data['job'].strip()
            if job_name:
                # Check if job exists
                cursor.execute("SELECT id FROM job WHERE name = %s", [job_name])
                existing_job = cursor.fetchone()
                
                if existing_job:
                    # Use existing job ID
                    data['job'] = existing_job[0]
                else:
                    # Create new job and use its ID
                    cursor.execute("INSERT INTO job (name) VALUES (%s)", [job_name])
                    new_job_id = cursor.lastrowid
                    data['job'] = new_job_id
        
        # Get field configs
        cursor.execute("SELECT field_name, field_type, lookup_sql FROM search_config WHERE table_name = %s", [table_name])
        fields = cursor.fetchall()
        field_names = [f[0] for f in fields]
        values = []
        for field_name, field_type, lookup_sql in fields:
            val = data.get(field_name)
            if val == "":
                val = None
            values.append(val)
        
        # Build insert SQL
        placeholders = ','.join(['%s'] * len(field_names))
        sql = f"INSERT INTO {table_name} ({','.join(field_names)}) VALUES ({placeholders})"
        cursor.execute(sql, values)
        
        # Commit transaction
        cursor.execute("COMMIT")
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        # Rollback transaction on error
        cursor.execute("ROLLBACK")
        return JsonResponse({'error': str(e)}, status=500)

@require_GET
@login_required
def api_record(request, table_name, record_id):
    """Return a single record as a dict of field_name -> value, using search_config for the field list."""
    cursor = connection.cursor()
    # Get field names from search_config
    cursor.execute("SELECT field_name FROM search_config WHERE table_name = %s ORDER BY id", [table_name])
    fields = [row[0] for row in cursor.fetchall()]
    if not fields:
        return JsonResponse({'error': 'No fields found.'}, status=404)
    # Always include id for lookup
    if 'id' not in fields:
        fields = ['id'] + fields
    
    # Handle job field - join with job table to get job name
    if 'job' in fields:
        # Replace job field with job name from join
        fields_with_job = []
        for field in fields:
            if field == 'job':
                fields_with_job.append('j.name as job')
            elif field == 'id':
                fields_with_job.append('t.id')
            else:
                fields_with_job.append(field)
        
        sql = f"SELECT {', '.join(fields_with_job)} FROM {table_name} t LEFT JOIN job j ON t.job = j.id WHERE t.id = %s"
    else:
        sql = f"SELECT {', '.join(fields)} FROM {table_name} WHERE id = %s"
    
    cursor.execute(sql, [record_id])
    row = cursor.fetchone()
    if not row:
        return JsonResponse({'error': 'Record not found.'}, status=404)
    
    # Create record dict, handling the job field specially
    record = {}
    for i, field in enumerate(fields):
        if field == 'job':
            record[field] = row[i]  # This will be the job name from the join
        else:
            record[field] = row[i]
    
    return JsonResponse(record)

@require_POST
@csrf_exempt
@login_required
def api_update(request, table_name, record_id):
    """Update a record in table_name by ID. Only updates fields defined in search_config."""
    data = json.loads(request.body)
    cursor = connection.cursor()
    
    try:
        # Start transaction
        cursor.execute("START TRANSACTION")
        
        # Handle job field specifically - create new job if it doesn't exist
        if 'job' in data and data['job']:
            job_name = data['job'].strip()
            if job_name:
                # Check if job exists
                cursor.execute("SELECT id FROM job WHERE name = %s", [job_name])
                existing_job = cursor.fetchone()
                
                if existing_job:
                    # Use existing job ID
                    data['job'] = existing_job[0]
                else:
                    # Create new job and use its ID
                    cursor.execute("INSERT INTO job (name) VALUES (%s)", [job_name])
                    new_job_id = cursor.lastrowid
                    data['job'] = new_job_id
        
        # Get field names from search_config
        cursor.execute("SELECT field_name FROM search_config WHERE table_name = %s ORDER BY id", [table_name])
        fields = [row[0] for row in cursor.fetchall()]
        if not fields:
            return JsonResponse({'error': 'No fields found.'}, status=404)
        # Remove 'id' from updatable fields
        updatable_fields = [f for f in fields if f != 'id']
        set_clauses = []
        values = []
        for field in updatable_fields:
            if field in data:
                set_clauses.append(f"{field} = %s")
                values.append(data[field] if data[field] != '' else None)
        if not set_clauses:
            return JsonResponse({'error': 'No fields to update.'}, status=400)
        values.append(record_id)
        sql = f"UPDATE {table_name} SET {', '.join(set_clauses)} WHERE id = %s"
        cursor.execute(sql, values)
        
        # Commit transaction
        cursor.execute("COMMIT")
        
        return JsonResponse({'success': True})
        
    except Exception as e:
        # Rollback transaction on error
        cursor.execute("ROLLBACK")
        return JsonResponse({'error': str(e)}, status=500)

@require_POST
@csrf_exempt
@login_required
def api_delete(request, table_name):
    """Bulk delete records in table_name by list of IDs."""
    data = json.loads(request.body)
    ids = data.get('ids', [])
    if not ids or not isinstance(ids, list):
        return JsonResponse({'error': 'No IDs provided.'}, status=400)
    cursor = connection.cursor()
    # Use parameterized query for safety
    placeholders = ','.join(['%s'] * len(ids))
    sql = f"DELETE FROM {table_name} WHERE id IN ({placeholders})"
    cursor.execute(sql, ids)
    return JsonResponse({'success': True, 'deleted': ids})

@require_GET
@login_required
def api_gsearch(request, table_name, field_name):
    print(f"api_gsearch: {table_name}, {field_name}")
    """Return autocomplete suggestions for GSearch operator as JSON."""
    q = request.GET.get('q', '').strip()
    cursor = connection.cursor()
    # Only allow alphanumeric/underscore field names for safety
    if not field_name.replace('_', '').isalnum():
        return JsonResponse({'options': []})
    # Build SQL
    sql = f"SELECT DISTINCT {field_name} FROM {table_name}"
    params = []
    if q:
        sql += f" WHERE {field_name} LIKE %s"
        params.append(f"%{q}%")
    sql += f" ORDER BY {field_name} LIMIT 20"
    cursor.execute(sql, params)
    options = [{'text': row[0]} for row in cursor.fetchall() if row[0] is not None]
    return JsonResponse({'options': options})

@require_POST
@csrf_exempt
@login_required
def api_search(request, table_name):
    """Return filtered grid data based on search filters and sort."""
    filters = json.loads(request.body)
    cursor = connection.cursor()
    # Get columns config
    cursor.execute("SELECT field_label, field_name, field_type FROM search_config WHERE table_name = %s ORDER BY id", [table_name])
    columns = [(row[0], row[1], row[2]) for row in cursor.fetchall()]
    select_fields = [col[1] for col in columns]
    # Build WHERE clause
    where_clauses = []
    params = []
    operator_map = {
        'equal': '=',
        'contains': 'LIKE',
        'greater': '>',
        'less': '<',
        'GSearch': 'LIKE',
        'not_equal': '!=',
        'not_contains': 'NOT LIKE',
        # Add more mappings as needed
    }
    for field, cond in filters.items():
        if field == 'sort':
            continue  # skip sort key
        op = cond.get('operator')
        val = cond.get('value')
        sql_op = operator_map.get(op, op)  # fallback to op if not mapped
        if op in ('contains', 'GSearch'):
            where_clauses.append(f"{field} {sql_op} %s")
            params.append(f"%{val}%")
        elif op == 'not_contains':
            where_clauses.append(f"{field} {sql_op} %s")
            params.append(f"%{val}%")
        elif op in ('equal', 'greater', 'less', 'not_equal'):
            where_clauses.append(f"{field} {sql_op} %s")
            params.append(val)
        elif op == 'IN':
            if isinstance(val, list):
                placeholders = ','.join(['%s'] * len(val))
                where_clauses.append(f"{field} IN ({placeholders})")
                params.extend(val)
        # Add more operators as needed
    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ''
    select_fields = ['id'] + select_fields
    # --- Handle sort array ---
    sort = filters.get('sort', [])
    valid_field_names = set(col[1] for col in columns)
    order_by_clauses = []
    if isinstance(sort, list):
        for s in sort:
            field = s.get('field')
            direction = s.get('direction', '').lower()
            if field in valid_field_names and direction in ('asc', 'desc'):
                order_by_clauses.append(f"{field} {direction.upper()}")
    if not order_by_clauses:
        order_by_clauses = ['id DESC']
    order_by_sql = 'ORDER BY ' + ', '.join(order_by_clauses)
    
    # Handle job field - join with job table to get job name
    if 'job' in select_fields:
        # Replace job field with job name from join
        select_fields_with_job = []
        for field in select_fields:
            if field == 'job':
                select_fields_with_job.append('j.name as job')
            elif field == 'id':
                select_fields_with_job.append('t.id')
            else:
                select_fields_with_job.append(field)
        
        # Update WHERE clauses to use table alias
        where_clauses_with_alias = []
        for clause in where_clauses:
            # Only replace exact field name matches, not partial matches
            if clause.startswith('job ') or ' job ' in clause or clause.endswith(' job'):
                # Replace job field references with table alias
                clause = clause.replace(' job ', ' j.name ').replace('job ', 'j.name ').replace(' job', ' j.name')
            where_clauses_with_alias.append(clause)
        
        where_sql = f"WHERE {' AND '.join(where_clauses_with_alias)}" if where_clauses_with_alias else ''
        sql = f"SELECT {', '.join(select_fields_with_job)} FROM {table_name} t LEFT JOIN job j ON t.job = j.id {where_sql} {order_by_sql}"
    else:
        sql = f"SELECT {', '.join(select_fields)} FROM {table_name} {where_sql} {order_by_sql}"
    
    print(f"sql: {sql}")
    cursor.execute(sql, params)
    
    # Handle field mapping correctly when we have aliases
    data = []
    for row in cursor.fetchall():
        row_dict = {}
        for i, field in enumerate(select_fields):
            if field == 'job' and 'j.name as job' in sql:
                # The job field comes from the alias
                row_dict[field] = row[i]
            else:
                row_dict[field] = row[i]
        data.append(row_dict)
    
    # Get total count
    if 'job' in select_fields:
        count_sql = f"SELECT COUNT(*) FROM {table_name} t LEFT JOIN job j ON t.job = j.id {where_sql}"
    else:
        count_sql = f"SELECT COUNT(*) FROM {table_name} {where_sql}"
    cursor.execute(count_sql, params)
    total_count = cursor.fetchone()[0]
    return JsonResponse({'columns': columns, 'data': data, 'total_count': total_count})

@require_GET
@login_required
def api_search_patterns(request, table_name):
    """Get all search patterns for the current user and table."""
    try:
        patterns = SearchPattern.objects.filter(
            tablename=table_name,
            username=request.user.username
        ).values('id', 'searchname', 'searchdata', 'created_at', 'updated_at')
        return JsonResponse({'patterns': list(patterns)})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_POST
@csrf_exempt
@login_required
def api_save_search_pattern(request, table_name):
    """Save or update a search pattern."""
    try:
        data = json.loads(request.body)
        searchname = data.get('searchname', '').strip()
        searchdata = data.get('searchdata', {})
        
        if not searchname:
            return JsonResponse({'error': 'Search name is required'}, status=400)
        
        if not searchdata:
            return JsonResponse({'error': 'Search data is required'}, status=400)
        
        # Check if pattern already exists for this user and table
        pattern, created = SearchPattern.objects.get_or_create(
            tablename=table_name,
            username=request.user.username,
            searchname=searchname,
            defaults={'searchdata': searchdata}
        )
        
        if not created:
            # Update existing pattern
            pattern.searchdata = searchdata
            pattern.save()
        
        return JsonResponse({
            'success': True,
            'pattern': {
                'id': pattern.id,
                'searchname': pattern.searchname,
                'searchdata': pattern.searchdata,
                'created_at': pattern.created_at.isoformat(),
                'updated_at': pattern.updated_at.isoformat()
            },
            'created': created
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_POST
@csrf_exempt
@login_required
def api_delete_search_pattern(request, table_name):
    """Delete a search pattern."""
    try:
        data = json.loads(request.body)
        searchname = data.get('searchname', '').strip()
        
        if not searchname:
            return JsonResponse({'error': 'Search name is required'}, status=400)
        
        # Delete the pattern
        deleted_count, _ = SearchPattern.objects.filter(
            tablename=table_name,
            username=request.user.username,
            searchname=searchname
        ).delete()
        
        if deleted_count == 0:
            return JsonResponse({'error': 'Search pattern not found'}, status=404)
        
        return JsonResponse({'success': True, 'deleted': searchname})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_GET
@login_required
def api_reset_grid(request, table_name):
    """Reset grid to original data without any filters."""
    cursor = connection.cursor()
    
    # Get form config to determine which fields to select
    form_cursor = connection.cursor()
    form_cursor.execute("SELECT * FROM forms WHERE tableview = %s", [table_name])
    form_row = form_cursor.fetchone()
    if not form_row:
        return JsonResponse({'error': 'Form not found.'}, status=404)
    
    select_fields_raw = [f.strip() for f in form_row[2].split(',')]
    
    # Get column config
    cursor.execute("SELECT field_label, field_name FROM search_config WHERE table_name = %s", [table_name])
    columns_config = cursor.fetchall()
    
    # Build select_fields and columns
    select_fields = []
    columns = []
    for field in select_fields_raw:
        if field.lower() == 'id':
            continue
        for label, name in columns_config:
            if name == field:
                select_fields.append(name)
                columns.append((label, name))
                break
    
    # Always keep ID in the SQL query
    sql_fields = [f.strip() for f in form_row[2].split(',')]
    
    # Handle job field - join with job table to get job name
    if 'job' in sql_fields:
        select_fields_with_job = []
        for field in sql_fields:
            if field == 'job':
                select_fields_with_job.append('j.name as job')
            elif field == 'id':
                select_fields_with_job.append('t.id')
            else:
                select_fields_with_job.append(field)
        
        sql = f"SELECT {', '.join(select_fields_with_job)} FROM {table_name} t LEFT JOIN job j ON t.job = j.id"
    else:
        sql = f"SELECT {', '.join(sql_fields)} FROM {table_name}"
    
    cursor.execute(sql)
    raw_data = cursor.fetchall()
    
    # Build data list
    data = []
    for row in raw_data:
        row_dict = {}
        for i, field in enumerate(sql_fields):
            if field == 'job' and 'j.name as job' in sql:
                row_dict[field] = row[i]
            else:
                row_dict[field] = row[i]
        data.append(row_dict)
    
    total_count = len(data)
    
    return JsonResponse({
        'columns': columns,
        'data': data,
        'total_count': total_count
    })

@csrf_exempt
@require_http_methods(["GET"])
@login_required
def api_grid_layouts(request, table_name):
    """Get all layouts for the current user and table"""
    try:
        username = request.user.username
        layouts = GridLayout.objects.filter(
            username=username,
            table_name=table_name
        ).order_by('-is_default', '-updated_at')
        
        layouts_data = []
        for layout in layouts:
            layouts_data.append({
                'id': layout.id,
                'layout_name': layout.layout_name,
                'is_default': layout.is_default,
                'created_at': layout.created_at.strftime('%Y-%m-%d %H:%M'),
                'updated_at': layout.updated_at.strftime('%Y-%m-%d %H:%M')
            })
        
        return JsonResponse({'layouts': layouts_data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
@login_required
def api_save_grid_layout(request, table_name):
    """Save current grid layout"""
    try:
        data = json.loads(request.body)
        username = request.user.username
        layout_name = data.get('layout_name')
        layout_json = data.get('layout_json')
        is_default = data.get('is_default', False)
        
        if not layout_name or not layout_json:
            return JsonResponse({'error': 'Layout name and layout data are required'}, status=400)
        
        # Check if layout with same name exists
        existing_layout = GridLayout.objects.filter(
            username=username,
            table_name=table_name,
            layout_name=layout_name
        ).first()
        
        if existing_layout:
            # Update existing layout
            existing_layout.layout_json = layout_json
            existing_layout.is_default = is_default
            existing_layout.save()
            return JsonResponse({'message': 'Layout updated successfully', 'layout_id': existing_layout.id})
        else:
            # Create new layout
            layout = GridLayout.objects.create(
                username=username,
                table_name=table_name,
                layout_name=layout_name,
                layout_json=layout_json,
                is_default=is_default
            )
            return JsonResponse({'message': 'Layout saved successfully', 'layout_id': layout.id})
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
@login_required
def api_load_grid_layout(request, table_name, layout_id):
    """Load a specific grid layout"""
    try:
        username = request.user.username
        layout = GridLayout.objects.get(
            id=layout_id,
            username=username,
            table_name=table_name
        )
        
        return JsonResponse({
            'layout_name': layout.layout_name,
            'layout_json': layout.layout_json,
            'is_default': layout.is_default
        })
    except GridLayout.DoesNotExist:
        return JsonResponse({'error': 'Layout not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["DELETE"])
@login_required
def api_delete_grid_layout(request, table_name, layout_id):
    """Delete a grid layout"""
    try:
        username = request.user.username
        layout = GridLayout.objects.get(
            id=layout_id,
            username=username,
            table_name=table_name
        )
        layout.delete()
        return JsonResponse({'message': 'Layout deleted successfully'})
    except GridLayout.DoesNotExist:
        return JsonResponse({'error': 'Layout not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
@login_required
def api_set_default_layout(request, table_name, layout_id):
    """Set a layout as default"""
    try:
        username = request.user.username
        layout = GridLayout.objects.get(
            id=layout_id,
            username=username,
            table_name=table_name
        )
        layout.is_default = True
        layout.save()
        return JsonResponse({'message': 'Default layout set successfully'})
    except GridLayout.DoesNotExist:
        return JsonResponse({'error': 'Layout not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
