(ns sublist)

(defn sublist?
  [sublist, superlist]
  (some #(= sublist %) (partition (count sublist) 1 superlist))
  )
(defn classify [list1 list2] ;; <- arglist goes here
  (cond (and (= (count list1) (count list2)) (= list1 list2)) :equal
        (and (> (count list1) (count list2)) (sublist? list2 list1)) :superlist
        (and (< (count list1) (count list2)) (sublist? list1 list2)) :sublist
        :else :unequal)
)
