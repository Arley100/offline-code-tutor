#include <iostream>
#include <vector>

int main() {
    std::vector<int> values{1, 2, 3};

    // Bug: i == values.size() is outside the vector.
    for (std::size_t i = 0; i <= values.size(); ++i) {
        std::cout << values[i] << '\n';
    }
}

