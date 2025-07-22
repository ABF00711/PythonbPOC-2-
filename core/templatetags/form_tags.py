from django import template
register = template.Library()

@register.filter(name='add_class')
def add_class(field, css):
    return field.as_widget(attrs={**field.field.widget.attrs, 'class': css})

@register.filter(name='attr')
def attr(field, args):
    # Usage: {{ field|attr:'placeholder:Email' }}
    arg_list = args.split(':', 1)
    if len(arg_list) == 2:
        key, value = arg_list
        return field.as_widget(attrs={**field.field.widget.attrs, key: value})
    return field 