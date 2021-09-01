---
title: Exploring the Blazor EditForm
date: 2021-08-30
oneliner: Exploring the Blazor EditForm
precis: Exploring the Blazor EditForm.
published: 2021-08-30
---

# Building a Blazor Database Pipeline

Publish Date: 2021-08-30
Last Updated: 2021-08-30

## Introduction

This article takes a bit of a dive into the Blazor Editing framework and how it all plugs together.

## The Classic Form

The razor code below shows a classic basic form.

```html
<EditForm Model="@model" OnValidSubmit="@HandleValidSubmit">
    <DataAnnotationsValidator />
    <ValidationSummary />
    <div class="col-md-4 col-12">
        <label class="form-label">First name</label>
        <inputtext class="form-control" @bind-value="model.FirstName">
        <div>
        <ValidationMessage For="() => model.FirstName">
        </div>
    </div>

    <div class="col-md-4 col-12 text-right">
        <button type="submit" class="btn btn-success">Submit</button>
    </div>
</Editform>
```

### Editform

`EditForm` requires an `EditContext`.  It will error on initialization if it doesn't have one.  You can either:

1. Pass it one explicitly as the `EditContext` parameter.
2. Pass it an object as `Model` from which it can construct an `EditContext`.

Don't pass it both, it doesn't like that either.  More about `EditContext` in a while.

If you pass it a `Model` it constructs the EditContext like this:

```csharp
  _editContext = new EditContext(Model!);
```

`EditForm` builds out the standard html form.  In Razor it looks something like this:

```html
<form @attributes="AdditionalAttributes" onsubmit="@_handleSubmitDelegate">
    <CascadingValue IsFixed Value="_editContext">
        @ChildContent
    </CacadingValue>
</form>
```

The business end is `_handleSubmitDelegate`.  This gets set in the constructor.

```csharp
    public EditForm()
    {
        _handleSubmitDelegate = HandleSubmitAsync;
    }
```
`HandleSubmitAsync` is shown below.

If `OnSubmit` has an assigned delegate it calls it and completes - there's no validation.  Otherwise, it calls `Validate` on the Edit context and either `OnValidSubmit` or `OnInvalidSubmit` dependant on the validation result and it they have assigned delegates.

```csharp
    private async Task HandleSubmitAsync()
    {
        Debug.Assert(_editContext != null);

        if (OnSubmit.HasDelegate)
        {
            // When using OnSubmit, the developer takes control of the validation lifecycle
            await OnSubmit.InvokeAsync(_editContext);
        }
        else
        {
            // Otherwise, the system implicitly runs validation on form submission
            var isValid = _editContext.Validate(); // This will likely become ValidateAsync later

            if (isValid && OnValidSubmit.HasDelegate)
            {
                await OnValidSubmit.InvokeAsync(_editContext);
            }

            if (!isValid && OnInvalidSubmit.HasDelegate)
            {
                await OnInvalidSubmit.InvokeAsync(_editContext);
            }
        }
    }
}
```

## EditContext

`EditContext` maintains the edit and validation state of the "model" object. It's initialized by passing it an object.  Normally a data class, but it can be anything.

It maintains the edit state and validation messages in an internal `_fieldStates` dictionary.  The `_fieldStates` dictionary consists of `FieldIdentifier`/`FieldState` pairs.

#### FieldIdentifier

`FieldIdentifier` is a `Struct` that is basically an object/string pair.  The `model` is the reference object and the `fieldname` is the name of the property in the object.  It contains an important internal method:

```csharp
private static void ParseAccessor<T>(Expression<Func<T>> accessor, out object model, out string fieldName)
```

This takes the `ValidationMassage` `For` or the `InputBase` `ValueExpression` Expression and figures out the FieldIdentifier for the property the expression refers to.

#### FieldState

`FieldState` has two primary properties:

1. A boolean `IsModified` property to track if it's changed.
2. `_validationMessageStores` - a `HashSet` of `ValidationMessageStore` objects

There's a collection of `ValidationMessageStore` objects, because each object that does validation adds/removes it's own `ValidationMessageStore` to the collection.  Why a collection rather than a single validationMessageStore?  I don't know, but there will be a very valid one.  We don't need to worry, `EditContext` has some convenient methods to get all the messages or only those for a specific `FieldIdentifier`.

### Maintaining Edit State

Each `InputBase` control within the `EditForm` captures the cascaded `EditState`.  When it's change event is triggered it calls `NotifyFieldChanged` on the `EditContext`.  It adds a pair to the `_fieldStates` collection and sets the `FieldState` object `IsModified` to true.  If an entry already exists in `_fieldStates` it updates the `FieldState` object `IsModified` to true.  Note that the `InputBase` controls don't reset the `FieldState` if you change the value back to the original - `InputBase` has no construct to track what the original value was.

`MarkAsUnmodified` is used to either clear a specific `FieldIdentifier` or clear all the entries.  These should be called as part of the save process.  `IsModified` is a method that checks all the `_fieldStates` to see if any are modified.

### Validation State

When the form is submitted `EditForm` calls `EditContext.Validate`. 

```csharp
public bool Validate()
{
    OnValidationRequested?.Invoke(this, ValidationRequestedEventArgs.Empty);
    return !GetValidationMessages().Any();
}
```

It invokes the `OnValidationRequested` event, and then checks if there are any Validation Messages in the `_fieldStates` validation message stores.

The obvious question at this point is who does the validation?

Look back at our form:

```html
<EditForm Model="@model" OnValidSubmit="@HandleValidSubmit">
    <DataAnnotationsValidator />
    ....
</Editform>
```

The answer is `DataAnnotationsValidator`.  It gets the cascaded `EditContext` and registers a delegate on the `EditContext.OnValidationRequested` event.  We won't look at the code because it's rather convolute.  What it does is clears the validation message store, get all the attribute validation information attached to the model properties and checks the value in the property against the validation information.  For any that fail, it logs one or more messages for the `FieldIdentifier` into the validation message store.  `DataAnnotationnValidator` is just one of several validators available.  I've written my own.













