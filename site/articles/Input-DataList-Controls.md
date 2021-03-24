---
title: Builing Blazor Editor Input Controls
oneliner: This article describes how to build custom editor Input controls.
precis: The third article in a series describing how to build Blazor edit forms/controls with state management, validation and form locking.  This article focuses on form locking.
date: 2021-03-17
published: 2021-03-22
---

# Building A DataList Control in Blazor

This article describes how to build an input control based on a DataList in Blazor, and make it behave like a Select.  *DataList* apppeared in HTML5.  Some browsers, particularly Safari were slow on the uptake, so using was a bit problematic in the early days of HTML5.  Today, all the major browsers on various platforms support it: you can see the support list [here](https://caniuse.com/?search=datalist).

We'll build two versions of the control using Blazor's `InputBase` as the base class.  Along the way we delve into the inner workings of `InputBase` and explore control binding.

## The Html DataList

When `Input` is linked to a `datalist`, it makes filtered suggestions based on the `datalist`.  Out-of-the-box, the user can select a suggestion or enter any text value.  The basic markup for the control is shown below.  Try it in a page.

```html
<input type="text" list="countrylist" />

<datalist id="countrylist" />
    <option value="Algeria" />
    <option value="Australia" />
    <option value="Austria" />
<datalist>
```

## Exploring binding in a Test Control

Before we build our controls, let's explore what's going on in bindings.  You can skip this section if you know your bind triumvirate.

Start with a standard Razor component and code behind file - *MyInput.razor* and *MyInput.Razor.cs*.

Add the following code to *MyInput.razor.cs*.

1. We have what is known as the "Triumverate" of bind properties.
   1. `Value` is the actual value to display.
   2. `ValueChanged` is a Callback that gets wired up to set the value in the parent.
   3. `ValueExpression` is a lambda expression that points back to the source property in the parent.  It's used to generate a `FieldIdentifier` used in validation and state management to uniquely identify the field.
2. `CurrentValue` is the control internal *Value*.  It updates `Value` and invokes `ValueChanged` when changed.
3. `AdditionalAttributes` is used to capture the class and other attributes added to the control.

```csharp
namespace MyNameSpace.Components
{
    public partial class MyInput
    {
        [Parameter] public string Value { get; set; }
        [Parameter] public EventCallback<string> ValueChanged { get; set; }
        [Parameter] public Expression<Func<string>> ValueExpression { get; set; }
        [Parameter(CaptureUnmatchedValues = true)] public IReadOnlyDictionary<string, object> AdditionalAttributes { get; set; }

        protected virtual string CurrentValue
        {
            get => Value;
            set
            {
                if (!value.Equals(this.Value))
                {
                    Value = value;
                    if (ValueChanged.HasDelegate)
                        _ = ValueChanged.InvokeAsync(value);
                }
            }
        }
    }
}
```

Add a Text `input` html control to the razor file.

1. Namespace is added so *Components* can be divided into subfolders as the number of source files grow.
2. `@bind-value` points to the controls `CurrentValue` property.
3. `@attributes` adds the control attributes to `input`.

```html
@namespace MyNameSpace.Components

<input type="text" @bind-value="this.CurrentValue" @attributes="this.AdditionalAttributes" />
```

#### Test Page

Add a Test page to *Pages* - or overwrite index if you're using a test site.  We'll use this for testing all the controls.

This doesn't need much explanation.  Bootstrap for formatting, classic `EditForm`.  `CheckButton` gives us a easy breakpoint we can hit to check values and objects.

You can see our `MyInput` in the form.

```html
@page "/"

@using MyNameSpace.Components

<EditForm Model="this.model" OnValidSubmit="this.ValidSubmit">
    <div class="container m-5 p-4 border border-secondary">
        <div class="row mb-2">
            <div class="col-12">
                <h2>Test Editor</h2>
            </div>
        </div>
        <div class="row mb-2">
            <div class="col-4 form-label" for="txtcountry">
                Country
            </div>
            <div class="col-4">
                <MyInput id="txtcountry" @bind-Value="model.Value" class="form-control"></MyInput>
            </div>
        </div>
        <div class="row mb-2">
            <div class="col-6">
            </div>
            <div class="col-6 text-right">
                <button class="btn btn-secondary" @onclick="(e) => this.CheckButton()">Check</button>
                <button type="submit" class="btn btn-primary">Submit</button>
            </div>
        </div>
    </div>
</EditForm>

<div class="container">
    <div class="row mb-2">
        <div class="col-4 form-label">
            Test Value
        </div>
        <div class="col-4 form-control">
            @this.model.Value
        </div>
    </div>
    <div class="row mb-2">
        <div class="col-4 form-label">
            Test Index
        </div>
        <div class="col-4 form-control">
            @this.model.index
        </div>
    </div>
</div>
```
```csharp
@code {

    Model model = new Model() { Value = "Australia", index = 2 };

    private void CheckButton()
    {
        var x = true;
    }

    private void ValidSubmit()
    {
        var x = true;
    }

    class Model
    {
        public string Value { get; set; } = string.Empty;
        public int index { get; set; } = 0;
    }
}
```

Note the value display update as you change the text in `MyInput`.

Under the hood the Razor compiler builds the section containing `MyInput` into component code like this:

```csharp
__builder2.OpenComponent<TestBlazorServer.Components.MyInput>(12);
__builder2.AddAttribute(13, "id", "txtcountry");
__builder2.AddAttribute(14, "class", "form-control");
__builder2.AddAttribute(15, "Value", Microsoft.AspNetCore.Components.CompilerServices.RuntimeHelpers.TypeCheck<System.String>(model.Value));
__builder2.AddAttribute(16, "ValueChanged", Microsoft.AspNetCore.Components.CompilerServices.RuntimeHelpers.TypeCheck<Microsoft.AspNetCore.Components.EventCallback<System.String>>(Microsoft.AspNetCore.Components.EventCallback.Factory.Create<System.String>(this, Microsoft.AspNetCore.Components.CompilerServices.RuntimeHelpers.CreateInferredEventCallback(this, __value => model.Value = __value, model.Value))));
__builder2.AddAttribute(17, "ValueExpression", Microsoft.AspNetCore.Components.CompilerServices.RuntimeHelpers.TypeCheck<System.Linq.Expressions.Expression<System.Func<System.String>>>(() => model.Value));
__builder2.CloseComponent();
```
You can see the compiled c# file in the *obj* folder.  On my project this is *\obj\Debug\net5.0\RazorDeclaration\Components\FormControls*.

`@bind-value` has translated into a full mapping to the `Value`, `ValueChanged` and `ValueExpression` triumvirate. The setting of `Value` and `ValueExpression` are self explanatory.  `ValueChanged` uses a code factory to generate a runtime method that maps to `ValueChanged` and sets model.Value to the value returned by `ValueChanged`.

This explains a common misconception - you can attach an event handler to `@onchange` like this:

```html
<input type="text" @bind-value ="model.Value" @onchange="(e) => myonchangehandler()"/>
```

There's no `@onchange` event on the control, and the one on the inner control is already bound so can't be bound a second time.  You get no error message, just no trigger.

## InputBase

Let's move on to `InputBase`.

First we'll look at `InputText` to see an implementation.

1. The Html *input* `value` is bound to `CurrentValue` and `onchange` event to `CurrentValueAsString`.  Any change in the value calls the setter for `CurrentValueASsString`.
2. `TryParseValueFromString` just passes on `value` (the entered value) as `result`.  There's no string to other type conversion to do.

```csharp
public class InputText : InputBase<string?>
{
    [DisallowNull] public ElementReference? Element { get; protected set; }

    protected override void BuildRenderTree(RenderTreeBuilder builder)
    {
        builder.OpenElement(0, "input");
        builder.AddMultipleAttributes(1, AdditionalAttributes);
        builder.AddAttribute(2, "class", CssClass);
        builder.AddAttribute(3, "value", BindConverter.FormatValue(CurrentValue));
        builder.AddAttribute(4, "onchange", EventCallback.Factory.CreateBinder<string?>(this, __value => CurrentValueAsString = __value, CurrentValueAsString));
        builder.AddElementReferenceCapture(5, __inputReference => Element = __inputReference);
        builder.CloseElement();
    }

    protected override bool TryParseValueFromString(string? value, out string? result, [NotNullWhen(false)] out string? validationErrorMessage)
    {
        result = value;
        validationErrorMessage = null;
        return true;
    }
}
``` 

Let's delve into `InputBase`.
  
The `onchange` event sets `CurrentValueAsString`. Note it's not virtual, so can't be overidden.

```csharp
protected string? CurrentValueAsString
{
    get => FormatValueAsString(CurrentValue);
    set
    {
        // clear the ValidationMessageStore
        _parsingValidationMessages?.Clear();

        bool parsingFailed;

        // Error if can't be null and value is null. 
        if (_nullableUnderlyingType != null && string.IsNullOrEmpty(value))
        {
            parsingFailed = false;
            CurrentValue = default!;
        }
        // Call TryParseValueFromString.  
        else if (TryParseValueFromString(value, out var parsedValue, out var validationErrorMessage))
        {
            // If we pass complete and set CurrentValue
            parsingFailed = false;
            CurrentValue = parsedValue!;
        }
        else
        {   
            // We reach here if we fail parsing
            // set flags and make sure we have a ValidationMessageStore
            parsingFailed = true;
            
            if (_parsingValidationMessages == null)
            {
                _parsingValidationMessages = new ValidationMessageStore(EditContext);
            }
            // Add a parsing error message to the store
            _parsingValidationMessages.Add(FieldIdentifier, validationErrorMessage);

            // Since we're not writing to CurrentValue, we'll need to notify about modification from here
            EditContext.NotifyFieldChanged(FieldIdentifier);
        }

        // skip the validation notification if we were previously valid and still are
        // if we failed this time notify 
        // if we failed last time but are ok now we need notify to get the validation controls cleared
        if (parsingFailed || _previousParsingAttemptFailed)
        {
            EditContext.NotifyValidationStateChanged();
            _previousParsingAttemptFailed = parsingFailed;
        }
    }
}
```

The input `value` binds to the `CurrentValue` getter, and `CurrentValueAsString` sets it.  Note again it's not `virtual` so no overide.

```csharp
    protected TValue? CurrentValue
    {
        // straight getter from Value
        get => Value;
        set
        {
            // Checks for equality between submitted value and class Value
            var hasChanged = !EqualityComparer<TValue>.Default.Equals(value, Value);
            // and if it's changed
            if (hasChanged)
            {
                // sets the class Value
                Value = value;
                // calls the ValueChanged EventHandler to update the parent value
                _ = ValueChanged.InvokeAsync(Value);
                // Notifies the EditContext that the field has changed and passes the FieldIdentifier
                EditContext.NotifyFieldChanged(FieldIdentifier);
            }
        }
    }
```

Finally, `TryParseValueFromString` is abstract so must be implemented in inherited classes.  It's purpose is to validate and convert the submitted string to the correct `TValue`.

```csharp
protected abstract bool TryParseValueFromString(string? value, [MaybeNullWhen(false)] out TValue result, [NotNullWhen(false)] out string? validationErrorMessage);
```

## Building our DataList Control

First we need a helper class to get the country list.  Get the full class from the Repo.

```csharp
using System.Collections.Generic;

namespace MyNameSpace.Data
{
    public static class Countries
    {
        public static List<KeyValuePair<int, string>> CountryList
        {
            get
            {
                List<KeyValuePair<int, string>> list = new List<KeyValuePair<int, string>>();
                var x = 1;
                foreach (var v in CountryArray)
                {
                    list.Add(new KeyValuePair<int, string>(x, v));
                    x++;
                }
                return list;
            }
        }

        public static SortedDictionary<int, string> CountryDictionary
        {
            get
            {
                SortedDictionary<int, string> list = new SortedDictionary<int, string>();
                var x = 1;
                foreach (var v in CountryArray)
                {
                    list.Add(x, v);
                    x++;
                }
                return list;
            }
        }

        public static string[] CountryArray = new string[]
        {
            "Afghanistan",
            "Albania",
            "Algeria",
.....
            "Zimbabwe",
        };
    }
}
```

### Build the control

This is the partial class, setting `TValue` as a `string`.  There are inline explanation notes.

```csharp
public partial class InputDataList : InputBase<string>
{
    // List of values for datalist
    [Parameter] public IEnumerable<string> DataList { get; set; }
        
    // parameter to restrict valid values to the list
    [Parameter] public bool RestrictToList { get; set; }

    // unique id for the datalist based on a guid - we may have more than one in a form
    private string dataListId { get; set; } = Guid.NewGuid().ToString();

    // instruction to CurrentStringValue that we are in RestrictToList mode and the user has tabbed
    private bool _valueSetByTab = false;
    // current typed value in the input box - kept up to date by UpdateEnteredText
    private string _typedText = string.Empty;

    // New method to parallel CurrentValueAsString
    protected string CurrentStringValue
    {
        get
        {
            // check if we have a match to the datalist and get the value from the list
            if (DataList != null && DataList.Any(item => item == this.Value))
                return DataList.First(item => item == this.Value);
            // if not return an empty string
            else if (RestrictToList)
                return string.Empty;
            else
                return _typedText;
        }
        set
        {
            // Check if we have a ValidationMessageStore
            // Either get one or clear the existing one
            if (_parsingValidationMessages == null)
                _parsingValidationMessages = new ValidationMessageStore(EditContext);
            else
                _parsingValidationMessages?.Clear(FieldIdentifier);

            // Set defaults
            string val = string.Empty;
            var _havevalue = false;
            // check if we have a previous valid value - we'll stick with this is the current attempt to set the value is invalid
            var _havepreviousvalue = DataList != null && DataList.Contains(value);

            // Set the value by tabbing in Strict mode.  We need to select the first entry in the DataList
            if (_setValueByTab)
            {
                if (!string.IsNullOrWhiteSpace(this._typedText))
                {
                    // Check if we have at least one match in the filtered list
                    _havevalue = DataList != null && DataList.Any(item => item.Contains(_typedText, StringComparison.CurrentCultureIgnoreCase));
                    if (_havevalue)
                    {
                        // the the first value
                        var filteredList = DataList.Where(item => item.Contains(_typedText, StringComparison.CurrentCultureIgnoreCase)).ToList();
                        val = filteredList[0];
                    }
                }
            }
            // Normal set
            else if (this.RestrictToList)
            {
                // Check if we have a match and set it if we do
                _havevalue = DataList != null && DataList.Contains(value);
                if (_havevalue)
                    val = DataList.First(item => item.Equals(value));
            }
            else
            {
                _havevalue = true;
                val = value;
            }

            // check if we have a valid value
            if (_havevalue)
            {
                // assign it to current value - this will kick off a ValueChanged notification on the EditContext
                this.CurrentValue = val;
                // Check if the last entry failed validation.  If so notify the EditContext that validation has changed i.e. it's now clear
                if (_previousParsingAttemptFailed)
                {
                    EditContext.NotifyValidationStateChanged();
                    _previousParsingAttemptFailed = false;
                }
            }
            // We don't have a valid value
            else
            {
                // check if we're reverting to the last entry.  If we don't have one the generate error message
                if (!_havepreviousvalue)
                {
                    // No match so add a message to the message store
                    _parsingValidationMessages?.Add(FieldIdentifier, "You must choose a valid selection");
                    // keep track of validation state for the next iteration
                    _previousParsingAttemptFailed = true;
                    // notify the EditContext whick will precipitate a Validation Message general update
                    EditContext.NotifyValidationStateChanged();
                }
            }
            // Clear the Tab notification flag
            _setValueByTab = false;
        }
    }

    // Keep _typedText up to date with typed entry
    private void UpdateEnteredText(ChangeEventArgs e)
        => _typedText = e.Value.ToString();

    // Detector for Tabbing away from the input
    private void OnKeyDown(KeyboardEventArgs e)
    {
        // Check if we have a Tab with some text already typed and are in RestrictToList Mode
        _setValueByTab = RestrictToList && (!string.IsNullOrWhiteSpace(e.Key)) && e.Key.Equals("Tab") && !string.IsNullOrWhiteSpace(this._typedText);
    }

    protected override bool TryParseValueFromString(string value, [MaybeNullWhen(false)] out string result, [NotNullWhen(false)] out string validationErrorMessage)
        => throw new NotSupportedException($"This component does not parse string inputs. Bind to the '{nameof(CurrentValue)}' property, not '{nameof(CurrentValueAsString)}'.");
}
```

And the Razor:

1. Input uses the CSS generated by the control.
2. Binds to `CurrentValue`.
3. Adds the additional Attributes, including the `Aria` generated by the control.
4. Binds `list` to the `datalist`.
5. Hooks up event handlers to `oninput` and `onkeydown`.
2. Builds the `datalist` from the control `DataList` property.

```html
@namespace MyNameSpace.Components
@inherits InputBase<string>

<input class="@CssClass" type="text" @bind-value="this.CurrentStringValue" @attributes="this.AdditionalAttributes" list="@dataListId" @oninput="UpdateEnteredText" @onkeydown="OnKeyDown" />

<datalist id="@dataListId">
    @foreach (var option in this.DataList)
    {
        <option value="@option" />
    }
</datalist>
```

Test the control in the test page.

```html
<div class="row mb-2">
    <div class="col-4 form-label" for="txtcountry">
        Country (Any Value)
    </div>
    <div class="col-4">
        <InputDataList @bind-Value="model.Value" DataList="Countries.CountryArray" class="form-control" placeholder="Select a country"></InputDataList>
    </div>
</div>
<div class="row mb-2">
    <div class="col-4 form-label" for="txtcountry">
        Country (Strict)
    </div>
    <div class="col-4">
        <InputDataList @bind-Value="model.StrictValue" DataList="Countries.CountryArray" RestrictToList="true" class="form-control" placeholder="Select a country"></InputDataList>
    </div>
    <div class="col-4">
        <ValidationMessage For="(() => model.StrictValue)"></ValidationMessage>
    </div>
</div>
```
```html
<div class="row mb-2">
    <div class="col-4 form-label">
        Country Value
    </div>
    <div class="col-4 form-control">
        @this.model.Value
    </div>
</div>
<div class="row mb-2">
    <div class="col-4 form-label">
        Country Strict Value
    </div>
    <div class="col-4 form-control">
        @this.model.StrictValue
    </div>
</div>
```
```html
class Model
{
    public string Value { get; set; } = string.Empty;
    public string StrictValue { get; set; } = string.Empty;
    public int Index { get; set; } = 0;
    public int TIndex { get; set; } = 0;
    public int Opinion { get; set; } = 0;
}
```

The control doesn't use `CurrentValueAsString` and `TryParseValueFromString`.  Instead We build a parallel `CurrentStringValue`,containing all the logic in both `CurrentValueAsString` and `TryParseValueFromString`, and wire the html input to it.  We don't use `TryParseValueFromString`, but as it's abstract we need to implement a blind version of it.

## Input Search Select Control

The Select replacement version of the control builds on `InputDataList`.  We:
1. Convert over to a key/value pair list with a generic key.
2. Add the extra logic for convertion from TValue to string and back in the Html *input*.
3. Add the generics handling within the class.

Copy `InputDataList` and rename it to `InputDataListSelect`.

Add the generic declaration.  The control will work with most obvious types as the Key - e.g. int, long, string.
```csharp
public partial class InputDataListSelect<TValue> : InputBase<TValue>
```

Change DataList to a `SortedDictionary`.
```csharp
[Parameter] public SortedDictionary<TValue, string> DataList { get; set; }
```

The extra private properties are as follows.

```csharp
// the EditContext ValidationMessageStore
private ValidationMessageStore? _parsingValidationMessages;
// field to manage parsing failure
private bool _previousParsingAttemptFailed = false;

```
`CurrentValue` has changed a little to handle K/V pairs and do K/V pair lookups.  Again the inline comments provide detail.

```csharp
protected string CurrentStringValue
{
    get
    {
        // check if we have a match to the datalist and get the value from the K/V pair
        if (DataList != null && DataList.Any(item => item.Key.Equals(this.Value)))
            return DataList.First(item => item.Key.Equals(this.Value)).Value;
        // if not return an empty string
        return string.Empty;
    }
    set
    {
        // Check if we have a ValidationMessageStore
        // Either get one or clear the existing one
        if (_parsingValidationMessages == null)
            _parsingValidationMessages = new ValidationMessageStore(EditContext);
        else
            _parsingValidationMessages?.Clear(FieldIdentifier);

        // Set defaults
        TValue val = default;
        var _havevalue = false;
        // check if we have a previous valid value - we'll stick with this is the current attempt to set the value is invalid
        var _havepreviousvalue = DataList != null && DataList.ContainsKey(this.Value);

        // Set the value by tabbing.  We need to select the first entry in the DataList
        if (_setValueByTab)
        {
            if (!string.IsNullOrWhiteSpace(this._typedText))
            {
                // Check if we have at least one K/V match in the filtered list
                _havevalue = DataList != null && DataList.Any(item => item.Value.Contains(_typedText, StringComparison.CurrentCultureIgnoreCase));
                if (_havevalue)
                {
                    // the the first K/V pair
                    var filteredList = DataList.Where(item => item.Value.Contains(_typedText, StringComparison.CurrentCultureIgnoreCase)).ToList();
                    val = filteredList[0].Key;
                }
            }
        }
        // Normal set
        else
        {
            // Check if we have a match and set it if we do
            _havevalue = DataList != null && DataList.ContainsValue(value);
            if (_havevalue)
                val = DataList.First(item => item.Value.Equals(value)).Key;
        }

        // check if we have a valid value
        if (_havevalue)
        {
            // assign it to current value - this will kick off a ValueChanged notification on the EditContext
            this.CurrentValue = val;
            // Check if the last entry failed validation.  If so notify the EditContext that validation has changed i.e. it's now clear
            if (_previousParsingAttemptFailed)
            {
                EditContext.NotifyValidationStateChanged();
                _previousParsingAttemptFailed = false;
            }
        }
        // We don't have a valid value
        else
        {
            // check if we're reverting to the last entry.  If we don't have one the generate error message
            if (!_havepreviousvalue)
            {
                // No K/V match so add a message to the message store
                _parsingValidationMessages?.Add(FieldIdentifier, "You must choose a valid selection");
                // keep track of validation state for the next iteration
                _previousParsingAttemptFailed = true;
                // notify the EditContext whick will precipitate a Validation Message general update
                EditContext.NotifyValidationStateChanged();
            }
        }
        // Clear the Tab notification flag
        _setValueByTab = false;
    }
}
```

`OnKeyDown` sets the `_setValurByTab` flag.

```csharp
private void UpdateEnteredText(ChangeEventArgs e)
    => _typedText = e.Value?.ToString();

private void OnKeyDown(KeyboardEventArgs e)
{
    // Check if we have a Tab with some text already typed
    _setValueByTab = ((!string.IsNullOrWhiteSpace(e.Key)) && e.Key.Equals("Tab") && !string.IsNullOrWhiteSpace(this._typedText));
}

// set as blind
protected override bool TryParseValueFromString(string? value, [MaybeNullWhen(false)] out TValue result, [NotNullWhen(false)] out string validationErrorMessage)
    => throw new NotSupportedException($"This component does not parse normal string inputs. Bind to the '{nameof(CurrentValue)}' property, not '{nameof(CurrentValueAsString)}'.");
```

The Razor is almost the same:

1. `datalist` changes to accommodate a K/V pair list.
2. Add the `@typeparam`.

```html
@namespace Blazor.Database.Components
@inherits InputBase<TValue>
@typeparam TValue

<input class="@CssClass" type="text" @bind-value="this.CurrentStringValue" @attributes="this.AdditionalAttributes" list="@dataListId" @oninput="UpdateEnteredText" @onkeydown="OnKeyDown" />

<datalist id="@dataListId">
    @foreach (var kv in this.DataList)
    {
        <option value="@kv.Value" />
    }
</datalist>
```

Test it by adding a row to the edit table in the test page.  Try entering an invalid string - something like "xxxx".

```html
<div class="row mb-2">
    <div class="col-4 form-label" for="txtcountry">
        Country T Index
    </div>
    <div class="col-4">
        <InputDataListSelect TValue="int" @bind-Value="model.TIndex" DataList="Countries.CountryDictionary" class="form-control" placeholder="Select a country"></InputDataListSelect>
    </div>
    <div class="col-4">
        <ValidationMessage For="(() => model.TIndex)"></ValidationMessage>
    </div>
</div>
```
```html
<div class="row mb-2">
    <div class="col-4 form-label">
        Country T Index
    </div>
    <div class="col-4 form-control">
        @this.model.TIndex
    </div>
</div>
```

```csharp
class Model
{
    public string Value { get; set; } = string.Empty;
    public string StrictValue { get; set; } = string.Empty;
    public int Index { get; set; } = 0;
    public int TIndex { get; set; } = 0;
    public int Opinion { get; set; } = 0;
}
```

## Wrap Up

Building edit components is not trivial, but also should not be feared.

The examples I've built are based on `InputBase`.  If you start building your own controls, I thoroughly recommend taking a little time and getting familiar with `InputBase` and it's siblings.  The code is [here](https://github.com/dotnet/aspnetcore/blob/main/src/Components/Web/src/Forms/InputBase.cs).
